import { query } from '../db.js';
import { validate, parseId } from '../utils/validate.js';
import { parsePaging, toPage } from '../utils/pagination.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { getScope, scopeCondition } from './scope.js';

const LIST_SCHEMA = {
  keyword: { type: 'string', max: 50 },
  groupId: { type: 'string', max: 18 },
  area: { type: 'string', max: 20 },
  shift: { type: 'string', max: 20 },
  position: { type: 'string', max: 20 },
  license: { type: 'string', max: 30 },
};

const likeEscape = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

const FROM_SQL = `FROM users u
  JOIN positions p ON p.id = u.position_id
  LEFT JOIN regions rg ON rg.id = u.region_id
  LEFT JOIN shifts sh ON sh.id = u.shift_id`;

// 密碼等敏感欄位完全不查。持有證照只算「今天有效」的；指定休假把區間展開成每一天。
const SELECT_SQL = `SELECT u.id, u.name, u.phone, u.employee_no, u.is_active, p.code AS position,
  rg.id AS region_id, rg.name AS region_name, rg.color, sh.name AS shift_name,
  (SELECT ul.leave_type FROM user_leaves ul WHERE ul.user_id = u.id ORDER BY ul.start_date DESC LIMIT 1) AS leave_type,
  COALESCE((SELECT array_agg(DISTINCT to_char(d, 'YYYY-MM-DD')) FROM user_leaves ul
    CROSS JOIN LATERAL generate_series(ul.start_date::timestamp, ul.end_date::timestamp, interval '1 day') d
    WHERE ul.user_id = u.id), '{}') AS leaves,
  COALESCE((SELECT array_agg(l.code ORDER BY l.id) FROM user_licenses x JOIN licenses l ON l.id = x.license_id
    WHERE x.user_id = u.id
      AND (x.effective_on IS NULL OR x.effective_on <= current_date)
      AND (x.expires_on IS NULL OR x.expires_on >= current_date)), '{}') AS licenses`;

export const mapEmployee = (row) => ({
  id: String(row.id),
  name: row.name,
  phone: row.phone || '',
  employeeNo: row.employee_no,
  position: row.position,
  groupId: row.region_id ? String(row.region_id) : '',
  groupName: row.region_name ? `${row.region_name}${row.shift_name || ''}` : '',
  area: row.region_name || '',
  shift: row.shift_name || '',
  groupColor: row.color || '',
  leaveType: row.leave_type || undefined,
  designatedLeaves: [...(row.leaves || [])].sort(),
  licenses: row.licenses || [],
  isActive: row.is_active,
});

export const buildEmployeeFilter = (filters, scope) => {
  const values = [];
  const where = [];
  const sc = scopeCondition(scope, 'rg.name', values);
  if (sc) where.push(sc);
  const add = (sql, v) => { values.push(v); where.push(sql.replace('?', `$${values.length}`)); };
  if (filters.keyword) {
    values.push(`%${likeEscape(filters.keyword)}%`);
    const p = `$${values.length}`;
    where.push(`(u.name ILIKE ${p} OR u.employee_no ILIKE ${p} OR u.phone ILIKE ${p})`);
  }
  if (filters.groupId) add('rg.id = ?::bigint', parseId(filters.groupId));
  if (filters.area) add('rg.name = ?', filters.area);
  if (filters.shift) add('sh.name = ?', filters.shift);
  if (filters.position) add('p.code = ?', filters.position);
  if (filters.license) {
    add(`EXISTS (SELECT 1 FROM user_licenses x JOIN licenses l ON l.id = x.license_id
      WHERE x.user_id = u.id AND l.code = ?
        AND (x.effective_on IS NULL OR x.effective_on <= current_date)
        AND (x.expires_on IS NULL OR x.expires_on >= current_date))`, filters.license);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
};

export const listEmployees = async (user, rawQuery) => {
  const filters = validate(rawQuery, LIST_SCHEMA);
  const paging = parsePaging(rawQuery);
  const { whereSql, values } = buildEmployeeFilter(filters, await getScope(user));
  const n = values.length;
  const [rows, total] = await Promise.all([
    query(`${SELECT_SQL} ${FROM_SQL} ${whereSql} ORDER BY rg.name NULLS LAST, sh.id NULLS LAST, u.employee_no LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...values, paging.limit, paging.offset]),
    query(`SELECT count(*)::int AS total ${FROM_SQL} ${whereSql}`, values),
  ]);
  return toPage(rows.rows.map(mapEmployee), total.rows[0].total, paging);
};

export const getEmployee = async (user, id) => {
  const empId = parseId(id);
  const { whereSql, values } = buildEmployeeFilter({}, await getScope(user));
  const cond = `${whereSql ? `${whereSql} AND` : 'WHERE'} u.id = $${values.length + 1}::bigint`;
  const rows = await query(`${SELECT_SQL} ${FROM_SQL} ${cond}`, [...values, empId]);
  if (rows.rows.length === 0) throw new AppError(404, ERROR_CODES.EMPLOYEE_NOT_FOUND, '找不到此員工');
  return mapEmployee(rows.rows[0]);
};
