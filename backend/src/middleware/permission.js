import { roleHasPermission } from '../services/permissions.js';
import { AppError, ERROR_CODES } from '../utils/response.js';

// 登入者是否擁有某權限（給 service 內部判斷用，例如特許排班警示）。
// 權限來自資料庫的 role_permissions（有快取，見 services/permissions.js）。
export const hasPermission = (user, code) => roleHasPermission(user?.role, code);

// 擁有其中任一個權限即可放行（例如讀取任務：任務管理或班表檢視都可以）
export const requireAnyPermission = (codes) => (req, res, next) => {
  if (!codes.some((c) => roleHasPermission(req.user?.role, c))) {
    return next(new AppError(403, ERROR_CODES.INSUFFICIENT_PERMISSIONS, '權限不足'));
  }
  next();
};

// 檢查登入者的角色是否擁有某權限；一律在後端判斷，不能只靠前端隱藏按鈕。
// 必須接在 requireAuth 後面（requireAuth 會先確保權限快取已載入）。
export const requirePermission = (code) => (req, res, next) => {
  if (!roleHasPermission(req.user?.role, code)) {
    return next(new AppError(403, ERROR_CODES.INSUFFICIENT_PERMISSIONS, '權限不足'));
  }
  next();
};
