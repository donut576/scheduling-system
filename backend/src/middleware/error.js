import { AppError, ERROR_CODES } from '../utils/response.js';

export const notFound = (req, res) =>
  res.status(404).json({ code: 40400, message: '找不到此路徑', data: null });

// 統一錯誤處理：已知錯誤回對應狀態與代碼；未知錯誤只回通用訊息，細節留在伺服器 log
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ code: err.code, message: err.message, data: null });
  }
  console.error(err);
  return res
    .status(500)
    .json({ code: ERROR_CODES.INTERNAL_ERROR, message: '伺服器發生錯誤', data: null });
};
