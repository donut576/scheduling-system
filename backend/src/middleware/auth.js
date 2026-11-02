import { config } from '../config.js';
import { verifyToken } from '../utils/token.js';
import { AppError, ERROR_CODES } from '../utils/response.js';

// 驗證 Authorization: Bearer <token>，通過後把使用者放到 req.user
export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verifyToken(token, config.jwtSecret);
  if (!payload) {
    return next(new AppError(401, ERROR_CODES.TOKEN_EXPIRED, '登入已過期，請重新登入'));
  }
  req.user = payload;
  next();
};
