import { pool } from '../db.js';
import { parseId } from '../utils/validate.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { initialPassword, encodePassword } from './password.js';

// 管理員把某位員工的密碼重設為預設密碼，下次登入會被要求改密碼。
// 路由要求 employee:reset_password（只有 ADMIN）。已停用的員工不能重設。
export const resetEmployeePassword = async (rawId) => {
  const id = parseId(rawId);
  const enc = encodePassword(initialPassword());
  const r = await pool.query(
    `UPDATE users SET password = $2, password_format = $3, must_change_password = TRUE, updated_at = now()
     WHERE id = $1::bigint AND is_active RETURNING id`, [id, enc.password, enc.format]);
  if (r.rows.length === 0) throw new AppError(404, ERROR_CODES.EMPLOYEE_NOT_FOUND, '找不到此員工');
  return null;
};
