import { withTransaction } from '../db.js';
import { validate, parseId } from '../utils/validate.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { hasPermission } from '../middleware/permission.js';
import { getScope, scopeCondition } from './scope.js';
import { runAlerts, recordAlerts, OVERRIDE_PERMISSION } from './alerts.js';
import { BODY_SCHEMA, fail, requireCustomer, assigneeIds, currentUserId } from './taskWrite.js';

const notFound = () => new AppError(404, ERROR_CODES.TASK_NOT_FOUND, '找不到此任務');

// 讀出資料庫裡目前的任務狀態（含可視範圍檢查）
const loadTaskState = async (q, scope, taskId, lock) => {
  const values = [taskId];
  const cond = scopeCondition(scope, 'r.name', values);
  const found = await q(`SELECT t.id::text AS id, t.status, t.customer_id::text AS customer_id, t.task_date::text AS date,
      t.time_mode, to_char(t.start_time, 'HH24:MI') AS start_time, to_char(t.end_time, 'HH24:MI') AS end_time, t.headcount
    FROM tasks t JOIN customers c ON c.id = t.customer_id LEFT JOIN regions r ON r.id = c.region_id
    WHERE t.id = $1::bigint ${cond ? `AND ${cond}` : ''} ${lock ? 'FOR UPDATE OF t' : ''}`, values);
  if (found.rows.length === 0) throw notFound();
  const row = found.rows[0];
  const a = await q('SELECT user_id::text AS id FROM task_assignees WHERE task_id = $1::bigint', [taskId]);
  return {
    taskId: row.id,
    status: row.status,
    customerId: row.customer_id,
    date: row.date,
    timeMode: row.time_mode,
    startTime: row.start_time,
    endTime: row.end_time,
    headcount: row.headcount,
    assigneeIds: a.rows.map((x) => x.id),
  };
};

// POST /tasks/validate（新增前預檢，id 為 null）與 POST /tasks/:id/validate（修改前預檢）。
// 只檢查、不寫入。body 沒帶的欄位，修改時用資料庫現有的值。
export const validateTask = async (user, id, raw) => {
  const taskId = id === null ? null : parseId(id);
  const b = validate(raw, BODY_SCHEMA);
  const cleared = (k) => raw && (raw[k] === '' || raw[k] === null);
  const scope = await getScope(user);

  return withTransaction(async (q) => {
    const old = taskId ? await loadTaskState(q, scope, taskId, false) : null;
    if (old?.status === 'CANCELLED') throw fail('已取消的任務不能修改');

    const customerId = b.branchId ? parseId(b.branchId) : old?.customerId;
    if (!customerId) throw fail('資料驗證失敗：branchId 必填');
    await requireCustomer(q, scope, customerId);

    const timeMode = b.timeMode || old?.timeMode || 'FIXED';
    const pick = (key, oldValue) => (cleared(key) ? null : (b[key] ?? oldValue ?? null));
    const flexible = timeMode === 'FLEXIBLE';
    const state = {
      taskId,
      customerId: String(customerId),
      date: pick('date', old?.date),
      timeMode,
      startTime: flexible ? null : pick('startTime', old?.startTime),
      endTime: flexible ? null : pick('endTime', old?.endTime),
      headcount: b.headcount ?? old?.headcount ?? 1,
      assigneeIds: b.assignees ? (await assigneeIds(q, b.assignees)).map(String) : (old?.assigneeIds ?? []),
    };
    if (!flexible && state.date && (!state.startTime || !state.endTime)) {
      throw fail('資料驗證失敗：固定時段必須填寫開始與結束時間');
    }
    const result = await runAlerts(q, state);
    return { ...result, canOverride: hasPermission(user, OVERRIDE_PERMISSION) };
  });
};

// POST /tasks/:id/override-warning：對已存在、目前有警示的任務補上特許備註
export const overrideWarning = async (user, id, remark) => {
  const taskId = parseId(id);
  const text = typeof remark === 'string' ? remark.trim() : '';
  if (!text) throw fail('資料驗證失敗：remark 必填');
  if (text.length > 500) throw fail('資料驗證失敗：remark 最多 500 字');
  const scope = await getScope(user);

  await withTransaction(async (q) => {
    const state = await loadTaskState(q, scope, taskId, true);
    if (state.status === 'CANCELLED') throw fail('已取消的任務不能修改');
    const result = await runAlerts(q, state);
    if (result.violations.length === 0) throw fail('此任務目前沒有排班警示，不需要特許');
    await q('UPDATE tasks SET override_remark = $2, updated_at = now() WHERE id = $1::bigint', [taskId, text]);
    const by = await currentUserId(q, user);
    await recordAlerts(q, by, taskId, { result, alertStatus: 'OVERRIDDEN' }, text);
  });
  return null;
};
