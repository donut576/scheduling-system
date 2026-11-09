import { withTransaction } from '../db.js';
import { validate, parseId } from '../utils/validate.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { getScope, customerScopeCondition } from './scope.js';
import { regionsOfArea } from './regions.js';
import { getCustomer } from './customers.js';

const fail = (msg, details = null) => new AppError(422, ERROR_CODES.VALIDATION_ERROR, `資料驗證失敗：${msg}`, details);
const notFound = () => new AppError(404, ERROR_CODES.CUSTOMER_NOT_FOUND, '找不到此客戶');

const RESTRICTIONS = ['NONE', 'PEST_CONTROL', 'PROFESSIONAL', 'CUSTOM'];

// 前端 CustomerFormData 的欄位。groupId 與 groupName 擇一：有 groupId 用既有集團，否則用名稱找（找不到就建立）。
export const CUSTOMER_SCHEMA = {
  groupId: { type: 'string', max: 18 },
  groupName: { type: 'string', max: 100 },
  branchName: { type: 'string', max: 100 },
  city: { type: 'string', max: 20 },
  district: { type: 'string', max: 20 },
  address: { type: 'string', max: 200 },
  contactName: { type: 'string', max: 50 },
  contactPhone: { type: 'string', max: 30 },
  contactEmail: { type: 'string', max: 100 },
  backupName: { type: 'string', max: 50 },
  backupPhone: { type: 'string', max: 30 },
  backupEmail: { type: 'string', max: 100 },
  requiredLicenses: { type: 'array', max: 10, of: { type: 'string', max: 30 } },
  licenseRestriction: { type: 'enum', values: RESTRICTIONS },
  licenseRestrictionNote: { type: 'string', max: 200 },
  remarks: { type: 'string', max: 1000 },
};

// 只接受有限的欄位；validate 不支援 number，這裡先把座標轉好再驗
const prepare = (raw) => {
  const src = raw && typeof raw === 'object' ? { ...raw } : {};
  for (const k of ['latitude', 'longitude']) {
    if (src[k] === '' || src[k] === null) delete src[k];
    else if (src[k] !== undefined && typeof src[k] !== 'number') src[k] = Number(src[k]);
  }
  return src;
};

// 前端傳 requiredLicenses 清單、後端存單一限制：有專技 > 有施藥 > 無
export const restrictionFrom = (b) => {
  if (b.licenseRestriction) return b.licenseRestriction;
  if (!b.requiredLicenses) return undefined;
  if (b.requiredLicenses.includes('PROFESSIONAL')) return 'PROFESSIONAL';
  if (b.requiredLicenses.includes('PEST_CONTROL')) return 'PEST_CONTROL';
  // 沒有指定證照，但有填「其他」的說明，視為自訂限制
  if (b.licenseRestrictionNote) return 'CUSTOM';
  return 'NONE';
};

const trimmed = (b) => {
  for (const k of ['groupName', 'branchName', 'city', 'district', 'address', 'contactName', 'contactPhone', 'contactEmail', 'backupName', 'backupPhone', 'backupEmail', 'licenseRestrictionNote']) {
    if (typeof b[k] === 'string') b[k] = b[k].trim();
  }
  return b;
};

const validateBody = (raw, { partial }) => {
  const src = prepare(raw);
  const errors = [];
  const b = trimmed(validateWithNumbers(src, errors));
  // validate 會丟掉空字串，所以「有帶備用窗口欄位但全是空的」要先記下來（代表使用者清空了備用窗口）
  b.backupCleared = BACKUP_KEYS.some((k) => k in src) && !backupFilled(b);
  if (!partial) {
    if (!b.groupId && !b.groupName) errors.push({ field: 'groupName', message: '必填（或提供 groupId）' });
    if (!b.branchName) errors.push({ field: 'branchName', message: '必填' });
    if (!b.city) errors.push({ field: 'city', message: '必填' });
    if (!b.district) errors.push({ field: 'district', message: '必填' });
  } else if (Boolean(b.city) !== Boolean(b.district)) {
    errors.push({ field: b.city ? 'district' : 'city', message: '縣市與行政區必須一起修改' });
  }
  if (b.licenseRestriction === 'CUSTOM' && !b.licenseRestrictionNote) {
    errors.push({ field: 'licenseRestrictionNote', message: '證照限制選「其他」時必填' });
  }
  if (b.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.contactEmail)) {
    errors.push({ field: 'contactEmail', message: 'Email 格式錯誤' });
  }
  errors.push(...backupErrors(b, partial));
  if (errors.length) throw fail(errors.map((e) => `${e.field} ${e.message}`).join('；'), errors);
  return b;
};
// 備用窗口（選填）：整組留白＝沒有；只要填了任何一欄，姓名、電話、信箱都要填
const BACKUP_KEYS = ['backupName', 'backupPhone', 'backupEmail'];
const backupFilled = (b) => BACKUP_KEYS.some((k) => b[k]);
const backupErrors = (b, partial) => {
  const errors = [];
  if (!backupFilled(b)) return errors;
  for (const [k, label] of [['backupName', '備用窗口姓名'], ['backupPhone', '備用窗口電話'], ['backupEmail', '備用窗口信箱']]) {
    if (!b[k]) errors.push({ field: k, message: `${label}必填（有填備用窗口就要填完整）` });
  }
  if (b.backupEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.backupEmail)) errors.push({ field: 'backupEmail', message: 'Email 格式錯誤' });
  if (!partial && !(b.contactName && b.contactEmail)) errors.push({ field: 'contactName', message: '要先填主要聯絡人（姓名與信箱），才能填備用窗口' });
  return errors;
};
// 座標以外的欄位走共用 validate；座標另外檢查範圍
const validateWithNumbers = (src, errors) => {
  const { latitude, longitude, ...rest } = src;
  const b = validate(rest, CUSTOMER_SCHEMA);
  for (const [k, lim] of [['latitude', 90], ['longitude', 180]]) {
    const v = src[k];
    if (v === undefined) continue;
    if (!Number.isFinite(v) || Math.abs(v) > lim) errors.push({ field: k, message: `必須是 -${lim} 到 ${lim} 之間的數字` });
    else b[k] = v;
  }
  return b;
};

// 縣市＋行政區必須在 PE 規則內；非副理／管理員還要至少屬於自己能看的群組
const checkArea = async (q, scope, city, district) => {
  const regions = await regionsOfArea(q, city, district);
  if (regions.length === 0) throw fail('此縣市／行政區不在服務轄區內', [{ field: 'district', message: '不在服務轄區內' }]);
  if (!scope.all && !regions.some((r) => scope.regionNames.includes(r))) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, '此地區不在你的轄區範圍內');
  }
  return regions;
};

const resolveGroup = async (q, b) => {
  if (b.groupId) {
    const r = await q('SELECT id FROM customer_groups WHERE id = $1::bigint', [parseId(b.groupId)]);
    if (r.rows.length === 0) throw fail('找不到此客戶集團', [{ field: 'groupId', message: '找不到' }]);
    return r.rows[0].id;
  }
  await q('INSERT INTO customer_groups (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [b.groupName]);
  return (await q('SELECT id FROM customer_groups WHERE name = $1', [b.groupName])).rows[0].id;
};

const ensureBranchNameFree = async (q, groupId, name, exceptId = null) => {
  const r = await q('SELECT 1 FROM customers WHERE group_id = $1 AND name = $2 AND is_active AND ($3::bigint IS NULL OR id <> $3::bigint)', [groupId, name, exceptId]);
  if (r.rows.length) throw fail('此集團下已有同名分店', [{ field: 'branchName', message: '同集團下分店名稱不可重複' }]);
};

// 主要聯絡人（slot 1）：資料表要求 email，所以姓名與 email 都有才會寫入
const upsertContact = async (q, customerId, b) => {
  if (!b.contactName || !b.contactEmail) return;
  await q(`INSERT INTO customer_contacts (customer_id, slot, name, phone, email) VALUES ($1, 1, $2, $3, $4)
    ON CONFLICT (customer_id, slot) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email`,
  [customerId, b.contactName, b.contactPhone || null, b.contactEmail]);
};
// 備用窗口（slot 2）：有填就新增或更新；有帶欄位但整組留白就刪除；沒帶欄位就不動
const upsertBackup = async (q, customerId, b) => {
  if (b.backupCleared) {
    await q('DELETE FROM customer_contacts WHERE customer_id = $1::bigint AND slot = 2', [customerId]);
    return;
  }
  if (!backupFilled(b)) return;
  await q(`INSERT INTO customer_contacts (customer_id, slot, name, phone, email) VALUES ($1, 2, $2, $3, $4)
    ON CONFLICT (customer_id, slot) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone, email = EXCLUDED.email`,
  [customerId, b.backupName, b.backupPhone, b.backupEmail]);
};
const reload = async (user, id) => {
  const found = await getCustomer(user, id);
  if (!found) throw notFound();
  return found;
};

export const createCustomer = async (user, raw) => {
  const b = validateBody(raw, { partial: false });
  const scope = await getScope(user);
  const id = await withTransaction(async (q) => {
    await checkArea(q, scope, b.city, b.district);
    const groupId = await resolveGroup(q, b);
    await ensureBranchNameFree(q, groupId, b.branchName);
    const r = await q(`INSERT INTO customers (group_id, name, city, district, address, latitude, longitude, license_restriction, license_restriction_note, remarks)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [groupId, b.branchName, b.city, b.district, b.address || null, b.latitude ?? null, b.longitude ?? null,
      restrictionFrom(b) || 'NONE', b.licenseRestrictionNote || null, b.remarks || null]);
    await upsertContact(q, r.rows[0].id, b);
    await upsertBackup(q, r.rows[0].id, b);
    return r.rows[0].id;
  });
  return reload(user, id);
};

export const updateCustomer = async (user, rawId, raw) => {
  const customerId = parseId(rawId);
  const b = validateBody(raw, { partial: true });
  const scope = await getScope(user);
  const id = await withTransaction(async (q) => {
    const values = [customerId];
    const cond = customerScopeCondition(scope, values);
    const found = await q(`SELECT c.id, c.group_id, c.name, c.city, c.district FROM customers c
      WHERE c.id = $1::bigint AND c.is_active ${cond ? `AND ${cond}` : ''} FOR UPDATE OF c`, values);
    if (found.rows.length === 0) throw notFound();
    const old = found.rows[0];

    if (b.city) await checkArea(q, scope, b.city, b.district);
    const groupId = b.groupId || b.groupName ? await resolveGroup(q, b) : old.group_id;
    if (b.branchName || groupId !== old.group_id) await ensureBranchNameFree(q, groupId, b.branchName || old.name, customerId);

    const sets = []; const vals = [];
    const set = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
    if (groupId !== old.group_id) set('group_id', groupId);
    if (b.branchName) set('name', b.branchName);
    if (b.city) { set('city', b.city); set('district', b.district); }
    for (const [key, col] of [['address', 'address'], ['latitude', 'latitude'], ['longitude', 'longitude'], ['remarks', 'remarks']]) {
      if (key in b) set(col, b[key]);
    }
    const restriction = restrictionFrom(b);
    if (restriction) {
      set('license_restriction', restriction);
      set('license_restriction_note', restriction === 'CUSTOM' ? b.licenseRestrictionNote : null);
    }
    if (sets.length) {
      vals.push(customerId);
      await q(`UPDATE customers SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}::bigint`, vals);
    }
    await upsertContact(q, customerId, b);
    await upsertBackup(q, customerId, b);
    return customerId;
  });
  return reload(user, id);
};

// 「刪除」＝停用：保留歷史任務，客戶從列表消失，同名分店可重新建立
export const disableCustomer = async (user, rawId) => {
  const customerId = parseId(rawId);
  const scope = await getScope(user);
  await withTransaction(async (q) => {
    const values = [customerId];
    const cond = customerScopeCondition(scope, values);
    const found = await q(`SELECT c.id FROM customers c WHERE c.id = $1::bigint AND c.is_active ${cond ? `AND ${cond}` : ''} FOR UPDATE OF c`, values);
    if (found.rows.length === 0) throw notFound();
    const open = await q(`SELECT count(*)::int AS n FROM tasks WHERE customer_id = $1::bigint
      AND status NOT IN ('CANCELLED') AND (task_date IS NULL OR task_date >= current_date)`, [customerId]);
    if (open.rows[0].n > 0) throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, `此客戶還有 ${open.rows[0].n} 筆未完成的任務，請先取消或移轉`);
    await q('UPDATE customers SET is_active = FALSE, updated_at = now() WHERE id = $1::bigint', [customerId]);
  });
  return null;
};
