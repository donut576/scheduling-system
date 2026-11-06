import { query } from '../db.js';
import { validate, parseId } from '../utils/validate.js';
import { parsePaging, toPage } from '../utils/pagination.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { getScope, customerScopeCondition, customerInRegionNames, CUSTOMER_REGION_JOIN } from './scope.js';
import { hasPermission } from '../middleware/permission.js';

export const TASK_TYPES = ['CONTRACT', 'ONETIME', 'ESR'];
export const TASK_STATUSES = ['UNSCHEDULED', 'SCHEDULED', 'MODIFIED', 'CONFIRMED', 'PENDING_APPROVAL', 'CANCELLED'];

const LIST_SCHEMA = {
  keyword: { type: 'string', max: 50 },
  taskType: { type: 'enum', values: TASK_TYPES },
  status: { type: 'enum', values: TASK_STATUSES },
  startDate: { type: 'date' },
  endDate: { type: 'date' },
  area: { type: 'string', max: 20 },
  groupId: { type: 'string', max: 18 },
  branchId: { type: 'string', max: 18 },
};

// LIKE 的特殊符號要跳脫，避免使用者輸入 % 或 _ 變成萬用字元
const likeEscape = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

// 組出 WHERE 條件。全部用參數（$1、$2…），使用者輸入不會直接進 SQL 字串。
export const buildTaskFilter = (filters, scope, { onlyScheduled = false } = {}) => {
  const where = [];
  const values = [];
  const add = (sql, v) => { values.push(v); where.push(sql.replace('?', `$${values.length}`)); };

  const sc = customerScopeCondition(scope, values);
  if (sc) where.push(sc);
  if (onlyScheduled) where.push("t.status NOT IN ('UNSCHEDULED', 'CANCELLED', 'PENDING_APPROVAL')");
  if (filters.keyword) {
    values.push(`%${likeEscape(filters.keyword)}%`);
    const p = `$${values.length}`;
    where.push(`(c.name ILIKE ${p} OR g.name ILIKE ${p} OR t.route ILIKE ${p} OR EXISTS (
      SELECT 1 FROM task_assignees ta JOIN users u ON u.id = ta.user_id WHERE ta.task_id = t.id AND u.name ILIKE ${p}))`);
  }
  if (filters.taskType) add('t.task_type = ?', filters.taskType);
  if (filters.status) add('t.status = ?', filters.status);
  if (filters.startDate) add('t.task_date >= ?::date', filters.startDate);
  if (filters.endDate) add('t.task_date <= ?::date', filters.endDate);
  if (filters.area) {
    values.push([filters.area]);
    where.push(customerInRegionNames('c', `$${values.length}`));
  }
  if (filters.groupId) add('g.id = ?::bigint', parseId(filters.groupId));
  if (filters.branchId) add('c.id = ?::bigint', parseId(filters.branchId));
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
};

// 預設排序：無日期的置頂 → 今天與未來依日期由近到遠（同日未排班在前，再依開始時間）→ 已過期的在最後，依日期由新到舊
const ORDER_SQL = `ORDER BY
  (t.task_date IS NOT NULL) ASC,
  COALESCE(t.task_date < current_date, FALSE) ASC,
  CASE WHEN t.task_date >= current_date THEN t.task_date END ASC,
  CASE WHEN t.task_date < current_date THEN t.task_date END DESC,
  (t.status <> 'UNSCHEDULED') ASC,
  t.start_time ASC NULLS LAST,
  t.id ASC`;

export const BASE_SELECT = `SELECT t.id, t.task_type, t.status, t.alert_status,
  to_char(t.task_date, 'YYYY-MM-DD') AS date, t.time_mode,
  to_char(t.start_time, 'HH24:MI') AS start_time, to_char(t.end_time, 'HH24:MI') AS end_time,
  (t.is_overnight OR COALESCE(t.end_time < t.start_time, FALSE)) AS is_overnight, t.time_remark, t.headcount, s.name AS shift, t.route, t.other_content_note, t.remarks,
  t.is_makeup, to_char(t.original_date, 'YYYY-MM-DD') AS original_date, t.makeup_reason,
  t.report_types, t.report_notes, t.override_remark, t.from_pending_id, t.series_id,
  t.created_by, t.created_at, t.updated_at, t.reject_reason, t.rejected_assignees,
  c.id AS customer_id, c.name AS branch_name, g.id AS group_id, g.name AS group_name
FROM tasks t
JOIN customers c ON c.id = t.customer_id
JOIN customer_groups g ON g.id = c.group_id
${CUSTOMER_REGION_JOIN}
LEFT JOIN shifts s ON s.id = t.shift_id`;

const iso = (d) => (d instanceof Date ? d.toISOString() : d);

// 資料庫列 → 前端 Task 格式（空值依前端慣例：日期、時間用空字串）
export const mapTask = (row, { contents = [], assignees = [], series = null } = {}) => ({
  id: String(row.id),
  groupId: String(row.group_id),
  groupName: row.group_name,
  branchId: String(row.customer_id),
  branchName: row.branch_name,
  taskType: row.task_type,
  date: row.date || '',
  startTime: row.start_time || '',
  endTime: row.end_time || '',
  isOvernight: row.is_overnight,
  timeMode: row.time_mode,
  timeRemark: row.time_remark || undefined,
  headcount: row.headcount,
  shift: row.shift || '',
  route: row.route || '',
  contents,
  otherContentNote: row.other_content_note || undefined,
  assignees,
  remarks: row.remarks || '',
  isMakeup: row.is_makeup,
  originalDate: row.original_date || undefined,
  makeupReason: row.makeup_reason || undefined,
  reportTypes: row.report_types || [],
  reportNotes: row.report_notes || undefined,
  recurrenceId: row.series_id ? String(row.series_id) : undefined,
  recurrenceRule: series || undefined,
  status: row.status,
  isApproved: false, // 核准流程完成後改由核准紀錄推算
  isFromPending: row.from_pending_id != null,
  alertStatus: row.alert_status,
  overrideRemark: row.override_remark || undefined,
  rejectReason: row.reject_reason || undefined,
  rejectedAssignees: row.rejected_assignees || undefined,
  createdBy: row.created_by != null ? String(row.created_by) : '',
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

// 一次補齊多筆任務的內容、指派人員、循環規則（避免每筆各查一次）
export const loadRelations = async (rows) => {
  if (rows.length === 0) return { contents: new Map(), assignees: new Map(), series: new Map() };
  const ids = rows.map((r) => r.id);
  const seriesIds = [...new Set(rows.map((r) => r.series_id).filter(Boolean))];
  const [c, a, s] = await Promise.all([
    query(`SELECT tc.task_id, sc.code FROM task_contents tc JOIN service_contents sc ON sc.id = tc.content_id
           WHERE tc.task_id = ANY($1::bigint[]) ORDER BY sc.id`, [ids]),
    query(`SELECT ta.task_id, u.id AS user_id, u.name, rg.id AS region_id, rg.name AS region_name, rg.color,
             COALESCE(array_agg(l.code ORDER BY l.id) FILTER (WHERE l.code IS NOT NULL), '{}') AS licenses
           FROM task_assignees ta
           JOIN tasks t ON t.id = ta.task_id
           JOIN users u ON u.id = ta.user_id
           LEFT JOIN regions rg ON rg.id = u.region_id
           LEFT JOIN user_licenses ul ON ul.user_id = u.id
             AND (ul.effective_on IS NULL OR ul.effective_on <= COALESCE(t.task_date, current_date))
             AND (ul.expires_on IS NULL OR ul.expires_on >= COALESCE(t.task_date, current_date))
           LEFT JOIN licenses l ON l.id = ul.license_id
           WHERE ta.task_id = ANY($1::bigint[])
           GROUP BY ta.task_id, u.id, u.name, rg.id, rg.name, rg.color, ta.assigned_at
           ORDER BY ta.assigned_at, u.id`, [ids]),
    seriesIds.length
      ? query(`SELECT id, frequency, interval_n, days_of_week, day_of_month, end_type,
                 to_char(end_date, 'YYYY-MM-DD') AS end_date, end_count
               FROM recurrence_series WHERE id = ANY($1::bigint[])`, [seriesIds])
      : { rows: [] },
  ]);
  const contents = new Map(); const assignees = new Map(); const series = new Map();
  c.rows.forEach((r) => contents.set(r.task_id, [...(contents.get(r.task_id) || []), r.code]));
  a.rows.forEach((r) => assignees.set(r.task_id, [...(assignees.get(r.task_id) || []), {
    employeeId: String(r.user_id), employeeName: r.name, licenses: r.licenses,
    area: r.region_name || undefined, groupId: r.region_id ? String(r.region_id) : undefined,
    groupColor: r.color || undefined,
  }]));
  s.rows.forEach((r) => series.set(r.id, {
    frequency: r.frequency, interval: r.interval_n,
    daysOfWeek: r.days_of_week || undefined, dayOfMonth: r.day_of_month || undefined,
    endType: r.end_type, endDate: r.end_date || undefined, endCount: r.end_count || undefined,
  }));
  return { contents, assignees, series };
};

export const listTasks = async (user, rawQuery) => {
  const filters = validate(rawQuery, LIST_SCHEMA);
  const paging = parsePaging(rawQuery);
  const scope = await getScope(user);
  const { whereSql, values } = buildTaskFilter(filters, scope, { onlyScheduled: !hasPermission(user, 'task:view') });
  const n = values.length;
  const sql = `${BASE_SELECT} ${whereSql} ${ORDER_SQL} LIMIT $${n + 1} OFFSET $${n + 2}`;
  const countSql = `SELECT count(*)::int AS total FROM tasks t
    JOIN customers c ON c.id = t.customer_id JOIN customer_groups g ON g.id = c.group_id
    ${CUSTOMER_REGION_JOIN} ${whereSql}`;
  const [rows, total] = await Promise.all([
    query(sql, [...values, paging.limit, paging.offset]),
    query(countSql, values),
  ]);
  const rel = await loadRelations(rows.rows);
  const list = rows.rows.map((r) => mapTask(r, {
    contents: rel.contents.get(r.id) || [], assignees: rel.assignees.get(r.id) || [], series: rel.series.get(r.series_id) || null,
  }));
  return toPage(list, total.rows[0].total, paging);
};

export const getTask = async (user, id) => {
  const taskId = parseId(id);
  const scope = await getScope(user);
  const { whereSql, values } = buildTaskFilter({}, scope, { onlyScheduled: !hasPermission(user, 'task:view') });
  const idCond = `${whereSql ? `${whereSql} AND` : 'WHERE'} t.id = $${values.length + 1}::bigint`;
  const rows = await query(`${BASE_SELECT} ${idCond}`, [...values, taskId]);
  if (rows.rows.length === 0) {
    // 不存在與「不在你的範圍內」回一樣的錯誤，避免洩漏別區任務是否存在
    throw new AppError(404, ERROR_CODES.TASK_NOT_FOUND, '找不到此任務');
  }
  const rel = await loadRelations(rows.rows);
  const r = rows.rows[0];
  return mapTask(r, { contents: rel.contents.get(r.id) || [], assignees: rel.assignees.get(r.id) || [], series: rel.series.get(r.series_id) || null });
};
