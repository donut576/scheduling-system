import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { getRegionAreas } from '../services/regions.js';

export const regionsRouter = Router();

// 登入後即可取得（客戶表單、篩選器都會用到）
regionsRouter.get('/regions/areas', requireAuth, asyncHandler(async (req, res) => ok(res, await getRegionAreas())));
