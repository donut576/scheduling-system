import { query } from '../db.js';
import { validate, parseId } from '../utils/validate.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { getScope, scopeCondition, customerScopeCondition, customerInRegionNames, customerInRegionId, CUSTOMER_REGION_JOIN } from './scope.js';
import { BASE_SELECT, loadRelations, mapTask } from './tasks.js';

export const DIMENSIONS = ['overview', 'customer', 'employee'];
// 排班可指派的職位（與前端 ASSIGNABLE_POSITIONS 一致）
const ASSIGNABLE_POSITIONS = ['STAFF', 'CONTRACT_STAFF'];
// 一次最多查 62 天（月檢視含前後補齊的週），避免一次撈太多
export const MAX_RANGE_DAYS = 62;

const QUERY_SCHEMA = {
  dimension: { type: 'enum', values: DIMENSIONS },
  startDate: { type: 'date', required: true },
  endDate: { type: 'date', required: true },
  groupId: { type: 'string', max: 18 },
  branchId: { type: 'string', max: 18 },
  employeeId: { type: 'string', max: 18 },
  areaId: { type: 'string', max: 18 },
  area: { type: 'string', max: 20 },
  shift: { type: 'string', max: 20 },
};

const fail = (msg) => new AppError(422, ERROR_CODES.VALIDATION_ERROR, msg);
const dayNumber = (ymd) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / 86400000);
export const addDays = (ymd, n) => new Date((dayNumber(ymd) + n) * 86400000).toISOString().slice(0, 10);

// 任務 → 日曆事件的起訖時間。彈性任務整天；跨夜任務的結束落在隔天。
export const eventRange = ({ date, time_mode: timeMode, start_time: start, end_time: end, is_overnight: overnight }) => {
  if (timeMode === 'FLEXIBLE') return { start: `${date}T00:00:00+08:00`, end: `${date}T23:59:00+08:00` };
  return {
    start: `${date}T${start}:00+08:00`,
    end: `${overnight ? addDays(date, 1) : date}T${end}:00+08:00`,
  };
};

// 事件的結束日期是否落在查詢範圍內（跨夜任務可能前一天開始）
export const overlapsRange = (range, startDate, endDate) =>
  range.end.slice(0, 10) >= startDate && range.start.slice(0, 10) <= endDate;

const parseQuery = (raw) => {
  const q = validate(raw, QUERY_SCHEMA);
  if (q.endDate < q.startDate) throw fail('資料驗證失敗：endDate 不可早於 startDate');
  if (dayNumber(q.endDate) - dayNumber(q.startDate) + 1 > MAX_RANGE_DAYS) {
    throw fail(`資料驗證失敗：查詢範圍最多 ${MAX_RANGE_DAYS} 天`);
  }
  return { ...q, dimension: q.dimension || 'customer' };
};

const eventsSql = (q, scope) => {
  const values = [q.startDate, q.endDate];
  const where = [
    "t.status NOT IN ('UNSCHEDULED', 'CANCELLED', 'PENDING_APPROVAL')",
    't.task_date IS NOT NULL',
    "t.task_date BETWEEN ($1::date - 1) AND $2::date", // 往前多抓一天，找跨夜任務
  ];
  const add = (sql, v) => { values.push(v); where.push(sql.replace('?', `$${values.length}`)); };
  const cond = customerScopeCondition(scope, values);
  if (cond) where.push(cond);
  if (q.groupId && q.dimension === 'customer') add('g.id = ?::bigint', parseId(q.groupId));
  if (q.branchId) add('c.id = ?::bigint', parseId(q.branchId));
  if (q.employeeId) add('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?::bigint)', parseId(q.employeeId));
  // 員工維度的轄區、班別是篩「員工列」，不是篩任務
  if (q.dimension !== 'employee') {
    if (q.area) { values.push([q.area]); where.push(customerInRegionNames('c', `$${values.length}`)); }
    if (q.areaId) { values.push(parseId(q.areaId)); where.push(customerInRegionId('c', `$${values.length}`)); }
    if (q.shift) add('s.name = ?', q.shift);
  }
  return { sql: `${BASE_SELECT} WHERE ${where.join(' AND ')} ORDER BY t.task_date, t.start_time NULLS FIRST, t.id`, values };
};

const customerResources = async (q, scope) => {
  const values = [];
  const where = ['c.is_active'];
  const add = (sql, v) => { values.push(v); where.push(sql.replace('?', `$${values.length}`)); };
  const cond = customerScopeCondition(scope, values);
  if (cond) where.push(cond);
  if (q.groupId) add('g.id = ?::bigint', parseId(q.groupId));
  if (q.branchId) add('c.id = ?::bigint', parseId(q.branchId));
  if (q.area) { values.push([q.area]); where.push(customerInRegionNames('c', `$${values.length}`)); }
  if (q.areaId) { values.push(parseId(q.areaId)); where.push(customerInRegionId('c', `$${values.length}`)); }
  const rows = await query(`SELECT g.id AS gid, g.name AS gname, c.id AS cid, c.name AS cname, r.color
    FROM customers c JOIN customer_groups g ON g.id = c.group_id ${CUSTOMER_REGION_JOIN}
    WHERE ${where.join(' AND ')} ORDER BY g.id, c.id`, values);
  const groups = new Map();
  for (const r of rows.rows) {
    const g = groups.get(r.gid) || { id: String(r.gid), title: r.gname, groupColor: r.color || undefined, children: [] };
    g.children.push({ id: String(r.cid), title: r.cname, groupColor: r.color || undefined });
    groups.set(r.gid, g);
  }
  return [...groups.values()];
};

const employeeResources = async (q, scope) => {
  const values = [ASSIGNABLE_POSITIONS];
  const where = ['u.is_active', 'p.code = ANY($1::text[])'];
  const add = (sql, v) => { values.push(v); where.push(sql.replace('?', `$${values.length}`)); };
  const cond = scopeCondition(scope, 'rg.name', values);
  if (cond) where.push(cond);
  if (q.employeeId) add('u.id = ?::bigint', parseId(q.employeeId));
  if (q.area) add('rg.name = ?', q.area);
  if (q.areaId) add('rg.id = ?::bigint', parseId(q.areaId));
  if (q.shift) add('sh.name = ?', q.shift);
  const rows = await query(`SELECT u.id, u.employee_no, u.name, rg.name AS region, rg.color, sh.name AS shift
    FROM users u JOIN positions p ON p.id = u.position_id
    LEFT JOIN regions rg ON rg.id = u.region_id LEFT JOIN shifts sh ON sh.id = u.shift_id
    WHERE ${where.join(' AND ')} ORDER BY rg.name NULLS LAST, sh.id NULLS LAST, u.employee_no`, values);
  return rows.rows.map((r) => {
    const tag = [r.region, r.shift].filter(Boolean).join(' ');
    return { id: String(r.id), employeeNo: r.employee_no, title: tag ? `${r.name} (${tag})` : r.name, groupColor: r.color || undefined };
  });
};

export const getSchedule = async (user, rawQuery) => {
  const q = parseQuery(rawQuery);
  const scope = await getScope(user);
  const { sql, values } = eventsSql(q, scope);
  const rows = (await query(sql, values)).rows;

  const inRange = rows
    .map((r) => ({ row: r, range: eventRange(r) }))
    .filter((x) => overlapsRange(x.range, q.startDate, q.endDate));
  const taskRows = inRange.map((x) => x.row);
  const rel = await loadRelations(taskRows);

  const ids = taskRows.map((r) => r.id);
  const customerIds = [...new Set(taskRows.map((r) => r.customer_id))];
  const [colors, alerts] = taskRows.length === 0 ? [{ rows: [] }, { rows: [] }] : await Promise.all([
    query(`SELECT c.id, r.color FROM customers c ${CUSTOMER_REGION_JOIN} WHERE c.id = ANY($1::bigint[])`, [customerIds]),
    query(`SELECT task_id, string_agg(message, '；' ORDER BY id) AS reason FROM task_alerts
           WHERE task_id = ANY($1::bigint[]) GROUP BY task_id`, [ids]),
  ]);
  const colorOf = new Map(colors.rows.map((r) => [String(r.id), r.color || undefined]));
  const reasonOf = new Map(alerts.rows.map((r) => [String(r.task_id), r.reason]));

  const baseEvents = inRange.map(({ row, range }) => {
    const assignees = rel.assignees.get(row.id) || [];
    const task = mapTask(row, { contents: rel.contents.get(row.id) || [], assignees, series: rel.series.get(row.series_id) || null });
    const color = colorOf.get(String(row.customer_id));
    return {
      id: `event-${row.id}`,
      taskId: String(row.id),
      resourceId: String(row.customer_id),
      title: `${row.group_name} - ${row.branch_name}`,
      start: range.start,
      end: range.end,
      groupName: row.group_name,
      branchName: row.branch_name,
      alertStatus: row.alert_status,
      isRecurring: row.series_id != null,
      isOvernight: row.is_overnight,
      isMakeup: row.is_makeup || undefined,
      originalDate: row.original_date || undefined,
      backgroundColor: color,
      borderColor: color,
      extendedProps: {
        taskType: row.task_type,
        shift: row.shift || '',
        assignees,
        contents: task.contents,
        reportTypes: task.reportTypes,
        reportNotes: task.reportNotes,
        isFromPending: task.isFromPending,
        isMakeup: row.is_makeup || undefined,
        originalDate: row.original_date || undefined,
        makeupReason: task.makeupReason,
        violationReason: row.alert_status === 'CLEAN' ? undefined : reasonOf.get(String(row.id)),
        overrideReason: task.overrideRemark,
        headcount: row.headcount,
        remarks: row.remarks || '',
        timeMode: row.time_mode,
        timeRemark: row.time_remark || undefined,
        route: row.route || '',
        task,
      },
    };
  });

  if (q.dimension === 'overview') return { events: baseEvents, resources: [] };

  if (q.dimension === 'customer') {
    const resources = await customerResources(q, scope);
    const valid = new Set(resources.flatMap((g) => g.children.map((b) => b.id)));
    return { events: baseEvents.filter((e) => valid.has(e.resourceId)), resources };
  }

  // 員工維度：每位指派人員一筆事件；只保留出現在員工列上的
  const resources = await employeeResources(q, scope);
  const valid = new Set(resources.map((r) => r.id));
  const events = baseEvents.flatMap((e) => e.extendedProps.assignees
    .filter((a) => valid.has(a.employeeId))
    .map((a) => ({ ...e, id: `${e.id}-${a.employeeId}`, resourceId: a.employeeId })));
  return { events, resources };
};
