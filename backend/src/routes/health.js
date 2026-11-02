import { Router } from 'express';
import { query } from '../db.js';
import { ok } from '../utils/response.js';

export const healthRouter = Router();

// 健康檢查：確認服務與資料庫都能連線
healthRouter.get('/health', async (req, res, next) => {
  try {
    await query('SELECT 1');
    ok(res, { status: 'ok', db: 'up' });
  } catch (err) {
    next(err);
  }
});
