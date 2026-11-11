import { pool } from '../db.js';
import { permissionsOf } from './permissions.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { verifyPassword, assertValidNewPassword, encodePassword } from './password.js';

// 資料庫的角色代碼 → 前端／權限表使用的代碼
const ROLE_ALIAS = { EMPLOYEE: 'STAFF' };
const toRole = (code) => ROLE_ALIAS[code] || code;

export const toDbProfile = (row) => {
  const role = toRole(row.role_code);
  return {
    id: row.id,
    name: row.name,
    employeeNo: row.employee_no,
    role,
    permissions: permissionsOf(role),
    mustChangePassword: row.must_change_password,
  };
};

const USER_SQL = `SELECT u.id::text AS id, u.name, u.employee_no, u.password, u.password_format,
    u.is_active, u.must_change_password, ro.code AS role_code
  FROM users u JOIN roles ro ON ro.id = u.role_id`;

// 員工編號 + 密碼登入。帳號不存在與密碼錯誤用同一句訊息（不透露帳號是否存在）；
// 密碼正確但帳號已停用，才會告知停用（此時已證明是本人）。
export const loginWithDb = async (account, password) => {
  const found = await pool.query(`${USER_SQL} WHERE u.employee_no = $1`, [String(account).trim()]);
  const row = found.rows[0];
  if (!row || !verifyPassword(row, password)) {
    throw new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, '員工編號或密碼錯誤');
  }
  if (!row.is_active) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, '此帳號已停用，請聯絡管理員');
  }
  await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1::bigint', [row.id]);
  return toDbProfile(row);
};

export const getDbProfile = async (userId) => {
  const found = await pool.query(`${USER_SQL} WHERE u.id = $1::bigint AND u.is_active`, [userId]);
  if (found.rows.length === 0) throw new AppError(401, ERROR_CODES.TOKEN_EXPIRED, '登入已過期，請重新登入');
  return toDbProfile(found.rows[0]);
};

// 使用者自己改密碼：要先輸入目前密碼。成功後 must_change_password 設為 false。
export const changePassword = async (userId, currentPassword, newPassword) => {
  const found = await pool.query(`${USER_SQL} WHERE u.id = $1::bigint AND u.is_active`, [userId]);
  const row = found.rows[0];
  if (!row) throw new AppError(401, ERROR_CODES.TOKEN_EXPIRED, '登入已過期，請重新登入');
  if (!verifyPassword(row, currentPassword)) {
    throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, '目前密碼不正確');
  }
  assertValidNewPassword(newPassword, currentPassword);
  const enc = encodePassword(newPassword);
  await pool.query(
    `UPDATE users SET password = $2, password_format = $3, must_change_password = FALSE, updated_at = now()
     WHERE id = $1::bigint`, [userId, enc.password, enc.format]);
  return null;
};
