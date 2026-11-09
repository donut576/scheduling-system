import { withTransaction } from '../db.js';
import { validate, parseId } from '../utils/validate.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { getScope } from './scope.js';
import { getEmployee } from './employees.js';

const fail = (msg, details = null) => new AppError(422, ERROR_CODES.VALIDATION_ERROR, `資料驗證失敗：${msg}`, details);

const POSITIONS = ['STAFF', 'CONTRACT_STAFF', 'LEADER', 'MANAGER', 'ADMIN_STAFF'];
const LEAVE_TYPES = ['REGULAR_LEAVE', 'ANNUAL_LEAVE', 'OTHER_LEAVE'];
// 職位決定登入角色（權限）。只有管理員可以改職位，避免低權限者幫自己或別人升權。
const ROLE_OF_POSITION = { STAFF: 'EMPLOYEE', CONTRACT_STAFF: 'EMPLOYEE', LEADER: 'LEADER', MANAGER: 'MANAGER', ADMIN_STAFF: 'ADMIN' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 前端 EmployeeFormData 的欄位；多餘的欄位（area、groupName 等）會被丟掉
export const EMPLOYEE_SCHEMA = {
  name: { type: 'string', max: 50 },
  phone: { type: 'string', max: 30 },
  email: { type: 'string', max: 100 },
  employeeNo: { type: 'string', max: 30 },
  position: { type: 'enum', values: POSITIONS },
  groupId: { type: 'string', max: 40 },
  shift: { type: 'string', max: 20 },
  leaveType: { type: 'enum', values: LEAVE_TYPES },
  designatedLeaves: { type: 'array', max: 400, of: { type: 'date' } },
  licenses: { type: 'array', max: 20, of: { type: 'string', max: 30 } },
};

// 管理員、副理以外只能看到與修改自己轄區的員工；一般員工只能改自己的電話與信箱
const SELF_FIELDS = ['phone', 'email'];

const LICENSE_ITEM_SCHEMA = {
  code: { type: 'string', required: true, max: 30 },
  effectiveOn: { type: 'date' },
  expiresOn: { type: 'date' },
};

// licenseDetails：[{ code, effectiveOn?, expiresOn? }]。日期留白（空字串、null）代表沒有限制。
// 回傳整理好的清單；格式不對會丟 422 並指出第幾筆。
export const parseLicenseDetails = (raw) => {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length > 20) throw fail('licenseDetails 必須是最多 20 筆的清單', [{ field: 'licenseDetails', message: '必須是清單' }]);
  const out = [];
  const seen = new Set();
  raw.forEach((item, i) => {
    const field = `licenseDetails[${i}]`;
    let d;
    try { d = validate(item, LICENSE_ITEM_SCHEMA); } catch (e) { throw fail(`${field} ${e.message.replace('資料驗證失敗：', '')}`, [{ field, message: e.message }]); }
    if (d.code === 'NONE') throw fail(`${field} 不可使用「無證照」，沒有證照請送空清單`, [{ field, message: '不可使用 NONE' }]);
    if (seen.has(d.code)) throw fail(`${field} 證照 ${d.code} 重複`, [{ field, message: '證照重複' }]);
    seen.add(d.code);
    if (d.effectiveOn && d.expiresOn && d.expiresOn < d.effectiveOn) {
      throw fail(`${field} 到期日不可早於生效日`, [{ field, message: '到期日不可早於生效日' }]);
    }
    out.push({ code: d.code, effectiveOn: d.effectiveOn ?? null, expiresOn: d.expiresOn ?? null });
  });
  return out;
};

export const validateBody = (raw, { partial }) => {
  const b = validate(raw, EMPLOYEE_SCHEMA);
  const details = parseLicenseDetails(raw?.licenseDetails);
  if (details) b.licenseDetails = details;
  for (const k of ['name', 'phone', 'email', 'employeeNo']) if (typeof b[k] === 'string') b[k] = b[k].trim();
  if (b.email) b.email = b.email.toLowerCase();
  const errors = [];
  if (!partial) {
    for (const [k, label] of [['name', '姓名'], ['phone', '電話'], ['email', '信箱'], ['employeeNo', '員工編號'], ['position', '職位']]) {
      if (!b[k]) errors.push({ field: k, message: `${label}必填` });
    }
  } else {
    // 更新時，有帶這些欄位就不可以是空的（信箱是必填欄位，不能被清空）
    for (const k of ['name', 'phone', 'email', 'employeeNo']) {
      if (k in (raw || {}) && !b[k]) errors.push({ field: k, message: '不可為空' });
    }
  }
  if (b.email && !EMAIL.test(b.email)) errors.push({ field: 'email', message: '信箱格式錯誤' });
  if (b.licenses?.includes('NONE') && b.licenses.length > 1) {
    errors.push({ field: 'licenses', message: '「無證照」不可與其他證照並存' });
  }
  if (errors.length) throw fail(errors.map((e) => `${e.field} ${e.message}`).join('；'), errors);
  return b;
};

const duplicate = (field, message) => new AppError(422, ERROR_CODES.VALIDATION_ERROR, `資料驗證失敗：${message}`, [{ field, message }]);

// 信箱、員工編號不可重複。先查一次給清楚的訊息；兩人同時送出時由資料庫唯一限制擋下（見 mapDbError）
const ensureUnique = async (q, b, exceptId = null) => {
  if (b.email) {
    const r = await q('SELECT 1 FROM users WHERE lower(email) = $1 AND ($2::bigint IS NULL OR id <> $2::bigint)', [b.email, exceptId]);
    if (r.rows.length) throw duplicate('email', '此信箱已被其他員工使用');
  }
  if (b.employeeNo) {
    const r = await q('SELECT 1 FROM users WHERE employee_no = $1 AND ($2::bigint IS NULL OR id <> $2::bigint)', [b.employeeNo, exceptId]);
    if (r.rows.length) throw duplicate('employeeNo', '此員工編號已存在');
  }
};

const mapDbError = (err) => {
  if (err?.code === '23505') {
    if (String(err.constraint).includes('email')) return duplicate('email', '此信箱已被其他員工使用');
    if (String(err.constraint).includes('employee_no')) return duplicate('employeeNo', '此員工編號已存在');
  }
  return err;
};

const lookupId = async (q, table, col, value, field, label) => {
  const r = await q(`SELECT id FROM ${table} WHERE ${col} = $1`, [value]);
  if (r.rows.length === 0) throw fail(`${field} 找不到${label}`, [{ field, message: `找不到${label}` }]);
  return r.rows[0].id;
};

// 群組：前端目前可能送 '台北-早班' 這類假資料格式，只有純數字 id 才處理，其他一律忽略
const resolveRegion = async (q, scope, groupId) => {
  if (groupId === undefined || !/^[1-9]\d{0,17}$/.test(groupId)) return undefined;
  const r = await q('SELECT id, name FROM regions WHERE id = $1::bigint', [groupId]);
  if (r.rows.length === 0) throw fail('groupId 找不到此群組', [{ field: 'groupId', message: '找不到此群組' }]);
  if (!scope.all && !scope.regionNames.includes(r.rows[0].name)) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, '此群組不在你的轄區範圍內');
  }
  return r.rows[0].id;
};

// 只送證照代碼（沒有日期）時：已經持有的證照保留原本的生效日、到期日，只增減證照，不會把期限清掉
const replaceLicenses = async (q, userId, codes) => {
  const before = await q(`SELECT l.code, ul.effective_on::text AS eff, ul.expires_on::text AS exp
    FROM user_licenses ul JOIN licenses l ON l.id = ul.license_id WHERE ul.user_id = $1::bigint`, [userId]);
  const kept = new Map(before.rows.map((r) => [r.code, { eff: r.eff, exp: r.exp }]));
  await q('DELETE FROM user_licenses WHERE user_id = $1::bigint', [userId]);
  const real = [...new Set(codes.filter((c) => c !== 'NONE'))];
  if (real.length === 0) return;
  const found = await q('SELECT id, code FROM licenses WHERE code = ANY($1::text[])', [real]);
  if (found.rows.length !== real.length) {
    const known = new Set(found.rows.map((r) => r.code));
    throw fail(`licenses 不認識的證照：${real.filter((c) => !known.has(c)).join('、')}`, [{ field: 'licenses', message: '不認識的證照代碼' }]);
  }
  for (const l of found.rows) {
    const old = kept.get(l.code);
    await q('INSERT INTO user_licenses (user_id, license_id, effective_on, expires_on) VALUES ($1::bigint, $2, $3::date, $4::date)',
      [userId, l.id, old?.eff ?? null, old?.exp ?? null]);
  }
};

// 有帶 licenseDetails 時以它為準（含生效日、到期日）；沒帶才看 licenses（只有代碼，沒有日期）
const replaceLicenseDetails = async (q, userId, details) => {
  await q('DELETE FROM user_licenses WHERE user_id = $1::bigint', [userId]);
  if (details.length === 0) return;
  const codes = details.map((d) => d.code);
  const found = await q('SELECT id, code FROM licenses WHERE code = ANY($1::text[])', [codes]);
  const idOf = new Map(found.rows.map((r) => [r.code, r.id]));
  const unknown = codes.filter((c) => !idOf.has(c));
  if (unknown.length) throw fail(`licenseDetails 不認識的證照：${unknown.join('、')}`, [{ field: 'licenseDetails', message: '不認識的證照代碼' }]);
  for (const d of details) {
    await q('INSERT INTO user_licenses (user_id, license_id, effective_on, expires_on) VALUES ($1::bigint, $2, $3::date, $4::date)',
      [userId, idOf.get(d.code), d.effectiveOn, d.expiresOn]);
  }
};

const saveLicenses = (q, userId, b) => {
  if (b.licenseDetails) return replaceLicenseDetails(q, userId, b.licenseDetails);
  if (b.licenses) return replaceLicenses(q, userId, b.licenses);
  return undefined;
};

// 把一串日期（YYYY-MM-DD）整理成連續的段落：['07-01','07-02','07-05'] → [{start:'07-01',end:'07-02'},{start:'07-05',end:'07-05'}]
const DAY_MS = 24 * 60 * 60 * 1000;
const toDateRuns = (dates) => {
  const days = [...new Set(dates)].sort();
  const runs = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    const gap = last ? (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${last.end}T00:00:00Z`)) / DAY_MS : 0;
    if (last && gap === 1) last.end = d;
    else runs.push({ start: d, end: d });
  }
  return runs;
};

const replaceLeaves = async (q, userId, dates, leaveType) => {
  await q('DELETE FROM user_leaves WHERE user_id = $1::bigint', [userId]);
  for (const r of toDateRuns(dates)) {
    await q('INSERT INTO user_leaves (user_id, start_date, end_date, leave_type) VALUES ($1::bigint, $2::date, $3::date, $4)', [userId, r.start, r.end, leaveType || 'REGULAR_LEAVE']);
  }
};

// 寫入成功後用「看全部」的身分重新讀取，避免員工本人沒有轄區時讀不到自己
const reload = (id) => getEmployee({ role: 'ADMIN' }, id);

export const createEmployee = async (user, raw) => {
  const b = validateBody(raw, { partial: false });
  const scope = await getScope(user);
  try {
    const id = await withTransaction(async (q) => {
      await ensureUnique(q, b);
      const roleId = await lookupId(q, 'roles', 'code', ROLE_OF_POSITION[b.position], 'position', '角色');
      const positionId = await lookupId(q, 'positions', 'code', b.position, 'position', '職位');
      const regionId = (await resolveRegion(q, scope, b.groupId)) ?? null;
      const shiftId = b.shift ? await lookupId(q, 'shifts', 'name', b.shift, 'shift', '班別') : null;
      const r = await q(`INSERT INTO users (employee_no, name, phone, email, role_id, position_id, region_id, shift_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [b.employeeNo, b.name, b.phone, b.email, roleId, positionId, regionId, shiftId]);
      const userId = r.rows[0].id;
      await saveLicenses(q, userId, b);
      if (b.designatedLeaves) await replaceLeaves(q, userId, b.designatedLeaves, b.leaveType);
      return userId;
    });
    return reload(id);
  } catch (err) {
    throw mapDbError(err);
  }
};

export const updateEmployee = async (user, rawId, raw) => {
  const targetId = parseId(rawId);
  let b = validateBody(raw, { partial: true });
  const scope = await getScope(user);
  try {
    const id = await withTransaction(async (q) => {
      const found = await q(`SELECT u.id, u.employee_no, p.code AS position, rg.name AS region_name
        FROM users u JOIN positions p ON p.id = u.position_id LEFT JOIN regions rg ON rg.id = u.region_id
        WHERE u.id = $1::bigint FOR UPDATE OF u`, [targetId]);
      if (found.rows.length === 0) throw new AppError(404, ERROR_CODES.EMPLOYEE_NOT_FOUND, '找不到此員工');
      const old = found.rows[0];

      // 副理、管理員之外的角色（一般員工；dev 登入叫 STAFF、資料庫叫 EMPLOYEE）一律只能改自己
      if (!['ADMIN', 'MANAGER', 'LEADER'].includes(user.role)) {
        if (!user.no || user.no !== old.employee_no) throw new AppError(403, ERROR_CODES.FORBIDDEN, '只能修改自己的資料');
        b = Object.fromEntries(Object.entries(b).filter(([k]) => SELF_FIELDS.includes(k)));
      } else if (!scope.all && !scope.regionNames.includes(old.region_name)) {
        throw new AppError(404, ERROR_CODES.EMPLOYEE_NOT_FOUND, '找不到此員工');
      }
      if (user.role !== 'ADMIN') {
        if (b.position && b.position !== old.position) throw new AppError(403, ERROR_CODES.FORBIDDEN, '只有系統管理員可以修改職位');
        if (b.employeeNo && b.employeeNo !== old.employee_no) throw new AppError(403, ERROR_CODES.FORBIDDEN, '只有系統管理員可以修改員工編號');
      }
      await ensureUnique(q, b, targetId);

      const sets = []; const vals = [];
      const set = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
      for (const [key, col] of [['name', 'name'], ['phone', 'phone'], ['email', 'email'], ['employeeNo', 'employee_no']]) {
        if (b[key] !== undefined) set(col, b[key]);
      }
      if (b.position && b.position !== old.position) {
        set('position_id', await lookupId(q, 'positions', 'code', b.position, 'position', '職位'));
        set('role_id', await lookupId(q, 'roles', 'code', ROLE_OF_POSITION[b.position], 'position', '角色'));
      }
      const regionId = await resolveRegion(q, scope, b.groupId);
      if (regionId !== undefined) set('region_id', regionId);
      if (b.shift) set('shift_id', await lookupId(q, 'shifts', 'name', b.shift, 'shift', '班別'));
      if (sets.length) {
        vals.push(targetId);
        await q(`UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}::bigint`, vals);
      }
      await saveLicenses(q, targetId, b);
      if (b.designatedLeaves) await replaceLeaves(q, targetId, b.designatedLeaves, b.leaveType);
      return targetId;
    });
    return reload(id);
  } catch (err) {
    throw mapDbError(err);
  }
};
