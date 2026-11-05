import { query, withTransaction } from '../db.js';
import { validate } from '../utils/validate.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { hasPermission } from '../middleware/permission.js';
import { getScope, customerScopeCondition, customerInRegionNames } from './scope.js';
import { TASK_TYPES, BASE_SELECT, loadRelations, mapTask } from './tasks.js';
import { currentUserId } from './taskWrite.js';

// 來源區間最多 62 天（和班表查詢一致）；一次最多複製 500 筆，避免單一交易過大
export const MAX_COPY_DAYS = 62;
export const MAX_COPY_TASKS = 500;
const DEFAULT_TASK_TYPES = ['CONTRACT', 'ONETIME'];

const SCHEMA = {
  sourceStartDate: { type: 'date', required: true },
  sourceEndDate: { type: 'date', required: true },
  targetStartDate: { type: 'date', required: true },
  targetEndDate: { type: 'date', required: true },
  employeeIds: { type: 'array', max: 200, of: { type: 'string', max: 18 } },
  area: { type: 'string', max: 20 },
  taskTypes: { type: 'array', max: 3, of: { type: 'enum', values: TASK_TYPES } },
};

const fail = (msg) => new AppError(422, ERROR_CODES.VALIDATION_ERROR, `資料驗證失敗：${msg}`);
const dayNumber = (ymd) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / 86400000);

// 檢查參數並算出要平移幾天。純函式，方便測試。
export const parseCopyParams = (raw) => {
  const p = validate(raw, SCHEMA);
  const sourceDays = dayNumber(p.sourceEndDate) - dayNumber(p.sourceStartDate) + 1;
  const targetDays = dayNumber(p.targetEndDate) - dayNumber(p.targetStartDate) + 1;
  if (sourceDays < 1) throw fail('sourceEndDate 不可早於 sourceStartDate');
  if (targetDays < 1) throw fail('targetEndDate 不可早於 targetStartDate');
  if (sourceDays > MAX_COPY_DAYS) throw fail(`來源區間最多 ${MAX_COPY_DAYS} 天`);
  if (targetDays < sourceDays) throw fail('目標區間不可短於來源區間');
  const offsetDays = dayNumber(p.targetStartDate) - dayNumber(p.sourceStartDate);
  if (offsetDays === 0) throw fail('目標區間不可與來源區間相同');
  return {
    ...p,
    taskTypes: p.taskTypes && p.taskTypes.length ? p.taskTypes : DEFAULT_TASK_TYPES,
    employeeIds: p.employeeIds && p.employeeIds.length ? p.employeeIds : null,
    offsetDays,
  };
};

// 組出「來源任務」的查詢條件：區間內、非取消、符合任務類型，並套用登入者的轄區範圍。
export const buildSourceFilter = (p, scope) => {
  const values = [p.sourceStartDate, p.sourceEndDate, p.taskTypes];
  const where = ["t.status <> 'CANCELLED'", 't.task_date BETWEEN $1::date AND $2::date', 't.task_type = ANY($3::text[])'];
  const sc = customerScopeCondition(scope, values);
  if (sc) where.push(sc);
  if (p.employeeIds) {
    values.push(p.employeeIds);
    where.push(`EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ANY($${values.length}::text[]::bigint[]))`);
  }
  if (p.area) {
    values.push([p.area]);
    const ph = `$${values.length}`;
    // 客戶屬於該群組，或來源任務有人員屬於該群組
    where.push(`(${customerInRegionNames('c', ph)} OR EXISTS (
      SELECT 1 FROM task_assignees ta JOIN users u ON u.id = ta.user_id JOIN regions rg ON rg.id = u.region_id
      WHERE ta.task_id = t.id AND rg.name = ANY(${ph}::text[])))`);
  }
  return { whereSql: where.join(' AND '), values };
};

// 複製班表：把來源區間的任務平移到目標區間。
// - 不帶指派人員（複製出來是「未排班」，之後再指派；警示規則到指派時才檢查）。
// - 目標日已有任務也照樣新增（不去重）。
// - 不帶循環設定、補班資訊、待排轉入來源，複製出來的是獨立的一般任務。
// - 來源客戶已停用的任務跳過（計入 skippedCount）。
// - 整批在同一個交易裡，任何錯誤都會全部復原。
export const copySchedule = async (user, raw) => {
  if (!hasPermission(user, 'task:create')) {
    throw new AppError(403, ERROR_CODES.INSUFFICIENT_PERMISSIONS, '權限不足：沒有新增任務的權限');
  }
  const p = parseCopyParams(raw);
  const scope = await getScope(user);

  const newIds = await withTransaction(async (q) => {
    const { whereSql, values } = buildSourceFilter(p, scope);
    const src = await q(`SELECT t.id, c.is_active AS customer_active FROM tasks t JOIN customers c ON c.id = t.customer_id
      WHERE ${whereSql} ORDER BY t.task_date, t.start_time NULLS FIRST, t.id`, values);
    if (src.rows.length > MAX_COPY_TASKS) {
      throw fail(`符合條件的任務有 ${src.rows.length} 筆，一次最多複製 ${MAX_COPY_TASKS} 筆，請縮小範圍`);
    }
    const active = src.rows.filter((r) => r.customer_active);
    const skipped = src.rows.length - active.length;

    const by = await currentUserId(q, user);
    const created = [];
    for (const row of active) {
      const ins = await q(`INSERT INTO tasks (customer_id, task_type, status, alert_status, task_date, time_mode, start_time, end_time,
          is_overnight, time_remark, headcount, shift_id, route, other_content_note, remarks, report_types, report_notes, created_by)
        SELECT customer_id, task_type, 'UNSCHEDULED', 'CLEAN', task_date + $2::int, time_mode, start_time, end_time,
          is_overnight, time_remark, headcount, shift_id, route, other_content_note, remarks, report_types, report_notes, $3::bigint
        FROM tasks WHERE id = $1::bigint RETURNING id`, [row.id, p.offsetDays, by]);
      const id = ins.rows[0].id;
      await q('INSERT INTO task_contents (task_id, content_id) SELECT $2::bigint, content_id FROM task_contents WHERE task_id = $1::bigint', [row.id, id]);
      created.push(id);
    }
    await q(`INSERT INTO audit_logs (action_type, operator_id, target_type, target_id, details)
      VALUES ('SCHEDULE_CHANGE', $1::bigint, 'schedule', $2, $3::jsonb)`,
    [by, `copy:${p.sourceStartDate}~${p.sourceEndDate}`, JSON.stringify({
      action: 'COPY', source: [p.sourceStartDate, p.sourceEndDate], target: [p.targetStartDate, p.targetEndDate],
      copied: created.length, skipped, taskTypes: p.taskTypes, area: p.area ?? null,
    })]);
    return { created, skipped };
  });

  // 回傳複製出的任務（依日期、時間排序），前端用第一筆與最後一筆的日期決定要跳到哪裡
  let tasks = [];
  if (newIds.created.length) {
    const rows = await query(`${BASE_SELECT} WHERE t.id = ANY($1::bigint[]) ORDER BY t.task_date, t.start_time NULLS FIRST, t.id`, [newIds.created]);
    const rel = await loadRelations(rows.rows);
    tasks = rows.rows.map((r) => mapTask(r, { contents: rel.contents.get(r.id) || [], assignees: [], series: null }));
  }
  return { copiedCount: newIds.created.length, skippedCount: newIds.skipped, tasks };
};
