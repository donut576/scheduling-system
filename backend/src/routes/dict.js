import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { buildDict } from '../services/dict.js';
import { ok } from '../utils/response.js';

export const dictRouter = Router();

// 登入後即可取得（任何角色都需要這些下拉選項）
dictRouter.get('/dict', requireAuth, async (req, res, next) => {
  try {
    ok(res, await buildDict(query));
  } catch (err) {
    next(err);
  }
});
