import { config } from '../config.js';
import { pool } from '../db.js';
import { verifyToken } from '../utils/token.js';
import { AppError, ERROR_CODES } from '../utils/response.js';

// 驗證 Authorization: Bearer <token>，通過後把使用者放到 req.user。
// 正式登入（token 內 src = 'db'）每次還會查資料庫：
//   1. 帳號被停用或刪除 → 401，手上還沒過期的 token 也立刻失效
//   2. 還在使用預設密碼（must_change_password）→ 403，除非這支 API 明確允許（改密碼、取得個人資料）
// 暫時固定登入（dev）的 token 不查資料庫，行為和以前一樣。
const build = ({ allowMustChange }) => async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = verifyToken(token, config.jwtSecret);
    if (!payload) throw new AppError(401, ERROR_CODES.TOKEN_EXPIRED, '登入已過期，請重新登入');
    if (payload.src === 'db') {
      const r = await pool.query('SELECT is_active, must_change_password FROM users WHERE id = $1::bigint', [payload.sub]);
      const row = r.rows[0];
      if (!row || !row.is_active) throw new AppError(401, ERROR_CODES.TOKEN_EXPIRED, '帳號已停用，請聯絡管理員');
      if (row.must_change_password && !allowMustChange) {
        throw new AppError(403, ERROR_CODES.PASSWORD_CHANGE_REQUIRED, '請先變更預設密碼');
      }
      payload.mustChangePassword = row.must_change_password;
    }
    req.user = payload;
    next();
  } catch (e) {
    next(e);
  }
};

export const requireAuth = build({ allowMustChange: false });
// 只給「改密碼」「取得個人資料」使用
export const requireAuthAllowMustChange = build({ allowMustChange: true });
