// 統一回應格式，對齊前端 ApiResponse<T>：{ code, message, data }；code 為 0 代表成功
export const ok = (res, data = null, message = 'ok') => res.json({ code: 0, message, data });

// 錯誤代碼沿用前端 src/constants/errorCodes.ts
export const ERROR_CODES = {
  INVALID_CREDENTIALS: 40001,
  TOKEN_EXPIRED: 40002,
  FORBIDDEN: 40301,
  INSUFFICIENT_PERMISSIONS: 40302,
  TASK_NOT_FOUND: 40401,
  EMPLOYEE_NOT_FOUND: 40402,
  CUSTOMER_NOT_FOUND: 40403,
  VALIDATION_ERROR: 42201,
  SCHEDULE_CONFLICT: 42202,
  LICENSE_CONFLICT: 42203,
  INTERNAL_ERROR: 50001,
};

export class AppError extends Error {
  // details：驗證失敗時列出每個欄位的問題，放在回應的 data.errors（可省略）
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
