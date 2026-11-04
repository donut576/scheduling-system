import { ROLE_PERMISSIONS } from '../data/rolePermissions.js';
import { AppError, ERROR_CODES } from '../utils/response.js';

// 登入者是否擁有某權限（給 service 內部判斷用，例如特許排班警示）
export const hasPermission = (user, code) => (ROLE_PERMISSIONS[user?.role] || []).includes(code);

// 檢查登入者的角色是否擁有某權限；一律在後端判斷，不能只靠前端隱藏按鈕。
// 必須接在 requireAuth 後面。正式登入完成後，權限改由資料庫的 role_permissions 提供。
export const requirePermission = (code) => (req, res, next) => {
  const granted = ROLE_PERMISSIONS[req.user?.role] || [];
  if (!granted.includes(code)) {
    return next(new AppError(403, ERROR_CODES.INSUFFICIENT_PERMISSIONS, '權限不足'));
  }
  next();
};
