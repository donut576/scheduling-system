import { createHash, randomBytes } from 'node:crypto';
import { pool, withTransaction } from '../db.js';
import { config } from '../config.js';
import { AppError, ERROR_CODES } from '../utils/response.js';
import { sendMail } from './mailer.js';
import { assertValidNewPassword, encodePassword } from './password.js';

// 忘記密碼（寄信重設）：
//   1. requestPasswordReset：輸入員工編號 → 寄一封含一次性連結的信
//   2. getResetTokenInfo：開連結時先確認連結還有效，並顯示員工編號
//   3. resetPasswordWithToken：用連結設定新密碼
// 安全原則：不論員工編號存不存在、有沒有信箱、是否停用，requestPasswordReset 都回一樣的結果（不透露帳號資訊）；
// 資料庫只存 token 的雜湊；用過、過期、被新申請取代的連結都會失效。

const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex');
const invalidLink = () => new AppError(422, ERROR_CODES.VALIDATION_ERROR, '連結已失效或已使用，請重新申請');

const buildMail = (user, link) => {
  const minutes = config.resetTokenTtlMin;
  const subject = '重設你的排班系統密碼';
  const text = `${user.name} 你好，\n\n我們收到了重設密碼的申請。請在 ${minutes} 分鐘內開啟下面的連結設定新密碼：\n\n${link}\n\n如果不是你本人申請，請忽略這封信，你的密碼不會改變。連結只能使用一次。`;
  const html = `<p>${user.name} 你好，</p><p>我們收到了重設密碼的申請。請在 ${minutes} 分鐘內點下面的按鈕設定新密碼。</p>
<p><a href="${link}" style="display:inline-block;background:#005EB8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">設定新密碼</a></p>
<p style="color:#888;font-size:12px">按鈕無法點擊時，請複製這個連結到瀏覽器：<br>${link}</p>
<p style="color:#888;font-size:12px">如果不是你本人申請，請忽略這封信，你的密碼不會改變。連結只能使用一次。</p>`;
  return { subject, text, html };
};

export const requestPasswordReset = async (rawAccount) => {
  const account = String(rawAccount ?? '').trim();
  if (!account) throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, '請輸入員工編號');
  try {
    const found = await pool.query(
      `SELECT id, name, email FROM users WHERE employee_no = $1 AND is_active`, [account]);
    const user = found.rows[0];
    if (!user || !user.email) return null; // 不存在、已停用或沒有信箱：靜默結束

    // 頻率限制：同一位員工在間隔內只寄一封
    const recent = await pool.query(
      `SELECT 1 FROM password_reset_tokens
       WHERE user_id = $1::bigint AND created_at > now() - ($2 || ' seconds')::interval LIMIT 1`,
      [user.id, String(config.resetRequestIntervalSec)]);
    if (recent.rows.length > 0) return null;

    const token = randomBytes(32).toString('base64url');
    await withTransaction(async (q) => {
      await q('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1::bigint AND used_at IS NULL', [user.id]);
      await q(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
               VALUES ($1::bigint, $2, now() + ($3 || ' minutes')::interval)`,
        [user.id, hashToken(token), String(config.resetTokenTtlMin)]);
    });
    const link = `${config.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await sendMail({ to: user.email, ...buildMail(user, link) });
  } catch (e) {
    // 寄信失敗不能讓使用者知道（否則等於透露帳號存在），只記在後端
    console.error('[passwordReset] 寄送重設信失敗：', e.message);
  }
  return null;
};

const findValidToken = async (q, token) => {
  const r = await q(
    `SELECT t.id, t.user_id, u.employee_no
     FROM password_reset_tokens t JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now() AND u.is_active`,
    [hashToken(token)]);
  return r.rows[0] || null;
};

export const getResetTokenInfo = async (token) => {
  if (typeof token !== 'string' || !token) throw invalidLink();
  const row = await findValidToken((s, p) => pool.query(s, p), token);
  if (!row) throw invalidLink();
  return { employeeNo: row.employee_no };
};

export const resetPasswordWithToken = async (token, newPassword) => {
  if (typeof token !== 'string' || !token) throw invalidLink();
  assertValidNewPassword(newPassword, null);
  const enc = encodePassword(newPassword);
  await withTransaction(async (q) => {
    const row = await findValidToken(q, token);
    if (!row) throw invalidLink();
    await q(
      `UPDATE users SET password = $2, password_format = $3, must_change_password = FALSE, updated_at = now()
       WHERE id = $1::bigint`, [row.user_id, enc.password, enc.format]);
    await q('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = $1::bigint AND used_at IS NULL', [row.user_id]);
  });
  return null;
};
