import { AppError, ERROR_CODES } from '../utils/response.js';

export const notFound = (req, res) =>
  res.status(404).json({ code: 40400, message: '找不到此路徑', data: null });

// PostgreSQL 錯誤代碼 → 對外的狀態與訊息（不把 SQL 細節回給前端）
const PG_ERRORS = {
  '23505': [409, ERROR_CODES.VALIDATION_ERROR, '資料已存在，請勿重複建立'], // 唯一值重複
  '23503': [422, ERROR_CODES.VALIDATION_ERROR, '關聯的資料不存在或仍被使用'], // 外鍵
  '23502': [422, ERROR_CODES.VALIDATION_ERROR, '缺少必填資料'], // NOT NULL
  '23514': [422, ERROR_CODES.VALIDATION_ERROR, '資料不符合規則'], // CHECK
  '22P02': [422, ERROR_CODES.VALIDATION_ERROR, '資料格式錯誤'], // 型別格式錯誤
};

// 統一錯誤處理：已知錯誤回對應狀態與代碼；未知錯誤只回通用訊息，細節留在伺服器 log
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    const data = err.details ? { errors: err.details } : null;
    return res.status(err.status).json({ code: err.code, message: err.message, data });
  }
  // 前端送來的 JSON 格式錯誤
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ code: ERROR_CODES.VALIDATION_ERROR, message: '請求內容不是正確的 JSON', data: null });
  }
  if (err?.code && PG_ERRORS[err.code]) {
    const [status, code, message] = PG_ERRORS[err.code];
    console.error('[db]', err.code, err.constraint || '');
    return res.status(status).json({ code, message, data: null });
  }
  console.error(err);
  return res
    .status(500)
    .json({ code: ERROR_CODES.INTERNAL_ERROR, message: '伺服器發生錯誤', data: null });
};
