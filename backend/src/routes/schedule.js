import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { getSchedule } from '../services/schedule.js';

export const scheduleRouter = Router();

// 排班日曆資料：events（事件）與 resources（客戶列或員工列）。dimension：overview／customer／employee
scheduleRouter.get('/schedule', requireAuth, requirePermission('schedule:view'),
  asyncHandler(async (req, res) => ok(res, await getSchedule(req.user, req.query))));
