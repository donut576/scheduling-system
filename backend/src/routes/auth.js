import { Router } from 'express';
import { config } from '../config.js';
import { DEV_USERS } from '../data/devUsers.js';
import { signToken } from '../utils/token.js';
import { requireAuthAllowMustChange } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, AppError, ERROR_CODES } from '../utils/response.js';
import { loginWithDb, getDbProfile, changePassword } from '../services/auth.js';
import { ensurePermissions, permissionsOf } from '../services/permissions.js';

export const authRouter = Router();

// 對齊前端 UserProfile：{ id, name, employeeNo, role, permissions, mustChangePassword }
const toDevProfile = (u) => ({
  id: u.id,
  name: u.name,
  employeeNo: u.employeeNo,
  role: u.role,
  permissions: permissionsOf(u.role),
  mustChangePassword: false,
});

// 登入：員工編號 + 密碼，查資料庫。
// ENABLE_DEV_LOGIN=true 時，開發用固定帳號（admin/manager/…）仍可登入，測試與 demo 不受影響；正式環境請關閉。
authRouter.post('/auth/login', asyncHandler(async (req, res) => {
  const { account, password } = req.body || {};
  if (typeof account !== 'string' || typeof password !== 'string' || !account.trim() || !password) {
    throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, '請輸入員工編號與密碼');
  }
  await ensurePermissions(); // 登入回傳的權限清單來自資料庫
  if (config.enableDevLogin) {
    const dev = DEV_USERS.find((u) => u.account === account && u.password === password);
    if (dev) {
      const accessToken = signToken({ sub: dev.id, role: dev.role, no: dev.employeeNo }, config.jwtSecret, config.tokenTtlSec);
      return ok(res, { accessToken, expiresIn: config.tokenTtlSec, user: toDevProfile(dev) });
    }
  }
  const user = await loginWithDb(account, password);
  const accessToken = signToken({ sub: user.id, role: user.role, no: user.employeeNo, src: 'db' }, config.jwtSecret, config.tokenTtlSec);
  ok(res, { accessToken, expiresIn: config.tokenTtlSec, user });
}));

authRouter.get('/auth/profile', requireAuthAllowMustChange, asyncHandler(async (req, res) => {
  if (req.user.src === 'db') return ok(res, await getDbProfile(req.user.sub));
  const dev = DEV_USERS.find((u) => u.id === req.user.sub);
  if (!dev) throw new AppError(401, ERROR_CODES.TOKEN_EXPIRED, '登入已過期，請重新登入');
  ok(res, toDevProfile(dev));
}));

// 使用者自己改密碼（含首次登入被要求改密碼）。固定帳號（dev）沒有資料庫密碼，不能改。
authRouter.post('/auth/change-password', requireAuthAllowMustChange, asyncHandler(async (req, res) => {
  if (req.user.src !== 'db') {
    throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, '固定登入帳號不能變更密碼');
  }
  const { currentPassword, newPassword } = req.body || {};
  await changePassword(req.user.sub, currentPassword, newPassword);
  ok(res, null, '密碼已更新');
}));
