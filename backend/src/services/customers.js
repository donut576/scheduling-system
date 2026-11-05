import { query } from '../db.js';
import { validate, parseId } from '../utils/validate.js';
import { parsePaging, toPage } from '../utils/pagination.js';
import { getScope, customerScopeCondition, CUSTOMER_REGION_JOIN } from './scope.js';

const LIST_SCHEMA = {
  keyword: { type: 'string', max: 50 },
  groupId: { type: 'string', max: 18 },
};

const likeEscape = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

// 資料表的「證照限制」→ 前端的 requiredLicenses 清單
const LICENSES_BY_RESTRICTION = { NONE: [], PEST_CONTROL: ['PEST_CONTROL'], PROFESSIONAL: ['PROFESSIONAL'], CUSTOM: [] };

const FROM_SQL = `FROM customers c
  JOIN customer_groups g ON g.id = c.group_id
  ${CUSTOMER_REGION_JOIN}
  LEFT JOIN customer_contacts p ON p.customer_id = c.id AND p.slot = 1`;

export const mapCustomer = (row) => ({
  id: String(row.id),
  groupId: String(row.group_id),
  groupName: row.group_name,
  branchId: String(row.id),
  branchName: row.name,
  address: row.address || '',
  latitude: row.latitude ?? undefined,
  longitude: row.longitude ?? undefined,
  contactName: row.contact_name || '',
  contactPhone: row.contact_phone || '',
  requiredLicenses: LICENSES_BY_RESTRICTION[row.license_restriction] || [],
  licenseRestriction: row.license_restriction,
  licenseRestrictionNote: row.license_restriction_note || undefined,
  remarks: row.remarks || '',
});

const SELECT_SQL = `SELECT c.id, c.name, c.address, c.latitude::float8 AS latitude, c.longitude::float8 AS longitude,
  c.license_restriction, c.license_restriction_note, c.remarks,
  g.id AS group_id, g.name AS group_name, p.name AS contact_name, p.phone AS contact_phone`;

// 只列出啟用中的客戶，並套用登入者的轄區範圍
export const buildCustomerFilter = (filters, scope) => {
  const values = [];
  const where = ['c.is_active'];
  const sc = customerScopeCondition(scope, values);
  if (sc) where.push(sc);
  if (filters.keyword) {
    values.push(`%${likeEscape(filters.keyword)}%`);
    where.push(`(c.name ILIKE $${values.length} OR g.name ILIKE $${values.length} OR c.address ILIKE $${values.length})`);
  }
  if (filters.groupId) {
    values.push(parseId(filters.groupId));
    where.push(`g.id = $${values.length}::bigint`);
  }
  return { whereSql: `WHERE ${where.join(' AND ')}`, values };
};

export const listCustomers = async (user, rawQuery) => {
  const filters = validate(rawQuery, LIST_SCHEMA);
  const paging = parsePaging(rawQuery);
  const { whereSql, values } = buildCustomerFilter(filters, await getScope(user));
  const n = values.length;
  const [rows, total] = await Promise.all([
    query(`${SELECT_SQL} ${FROM_SQL} ${whereSql} ORDER BY g.name, c.name, c.id LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...values, paging.limit, paging.offset]),
    query(`SELECT count(*)::int AS total ${FROM_SQL} ${whereSql}`, values),
  ]);
  return toPage(rows.rows.map(mapCustomer), total.rows[0].total, paging);
};

// 客戶群組＋底下的分店（新增任務的「集團／分店」下拉用）
export const listCustomerGroups = async (user) => {
  const { whereSql, values } = buildCustomerFilter({}, await getScope(user));
  const rows = await query(`${SELECT_SQL} ${FROM_SQL} ${whereSql} ORDER BY g.name, c.name, c.id`, values);
  const groups = new Map();
  for (const row of rows.rows) {
    const c = mapCustomer(row);
    if (!groups.has(c.groupId)) groups.set(c.groupId, { id: c.groupId, name: c.groupName, branches: [] });
    groups.get(c.groupId).branches.push({
      id: c.id, groupId: c.groupId, name: c.branchName, address: c.address,
      latitude: c.latitude, longitude: c.longitude, contactName: c.contactName, contactPhone: c.contactPhone,
      requiredLicenses: c.requiredLicenses, licenseRestrictionNote: c.licenseRestrictionNote,
    });
  }
  return [...groups.values()];
};
