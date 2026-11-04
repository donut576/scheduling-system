import { Router } from 'express';
import { config } from '../config.js';
import { DEV_USERS } from '../data/devUsers.js';
import { ROLE_PERMISSIONS } from '../data/rolePermissions.js';
import { signToken } from '../utils/token.js';
import { requireAuth } from '../middleware/auth.js';
import { ok, AppError, ERROR_CODES } from '../utils/response.js';

export const authRouter = Router();

// 對齊前端 UserProfile：{ id, name, employeeNo, role, permissions }
const toProfile = (u) => ({
  id: u.id,
  name: u.name,
  employeeNo: u.employeeNo,
  role: u.role,
  permissions: ROLE_PERMISSIONS[u.role] || [],
});

// 暫時固定登入：只比對 DEV_USERS，不查資料庫（正式登入完成後改掉）
authRouter.post('/auth/login', (req, res, next) => {
  const { account, password } = req.body || {};
  if (typeof account !== 'string' || typeof password !== 'string' || !account || !password) {
    return next(new AppError(422, ERROR_CODES.VALIDATION_ERROR, '請輸入帳號與密碼'));
  }
  if (!config.enableDevLogin) {
    return next(new AppError(503, ERROR_CODES.INTERNAL_ERROR, '登入功能尚未開放'));
  }
  const user = DEV_USERS.find((u) => u.account === account && u.password === password);
  if (!user) {
    return next(new AppError(401, ERROR_CODES.INVALID_CREDENTIALS, '帳號或密碼錯誤'));
  }
  const accessToken = signToken({ sub: user.id, role: user.role, no: user.employeeNo }, config.jwtSecret, config.tokenTtlSec);
  ok(res, { accessToken, expiresIn: config.tokenTtlSec, user: toProfile(user) });
});

authRouter.get('/auth/profile', requireAuth, (req, res, next) => {
  const user = DEV_USERS.find((u) => u.id === req.user.sub);
  if (!user) return next(new AppError(401, ERROR_CODES.TOKEN_EXPIRED, '登入已過期，請重新登入'));
  ok(res, toProfile(user));
});
