import { timingSafeEqual } from 'node:crypto';
import { AppError, ERROR_CODES } from '../utils/response.js';

// 密碼規則與存取集中在這個檔案。目前依主管決定存明碼（password_format = 'PLAIN'）；
// 日後要改雜湊，只需改 encodePassword 與 verifyPassword 兩個函式（欄位 password_format 已預留 'BCRYPT'）。

export const DEFAULT_PASSWORD = 'Ecolab1234';
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

// 新員工、管理員重設時給的初始密碼。要改成「每人隨機」只需改這個函式。
export const initialPassword = () => DEFAULT_PASSWORD;

// 把使用者輸入的密碼轉成要寫進資料庫的欄位值
export const encodePassword = (plain) => ({ password: plain, format: 'PLAIN' });

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// row 需包含 password、password_format
export const verifyPassword = (row, plain) => {
  if (typeof plain !== 'string') return false;
  if (row.password_format === 'PLAIN') return safeEqual(row.password, plain);
  return false; // 雜湊格式尚未支援
};

// 新密碼規則：至少 8 碼、不可是預設密碼、不可與目前密碼相同。違反時丟 422。
export const assertValidNewPassword = (newPassword, currentPassword) => {
  const fail = (msg) => { throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, msg); };
  if (typeof newPassword !== 'string' || newPassword === '') fail('請輸入新密碼');
  if (newPassword.length < MIN_PASSWORD_LENGTH) fail(`新密碼至少 ${MIN_PASSWORD_LENGTH} 碼`);
  if (newPassword.length > MAX_PASSWORD_LENGTH) fail(`新密碼最多 ${MAX_PASSWORD_LENGTH} 碼`);
  if (newPassword === DEFAULT_PASSWORD) fail('新密碼不能是預設密碼');
  if (newPassword === currentPassword) fail('新密碼不能與目前密碼相同');
};
