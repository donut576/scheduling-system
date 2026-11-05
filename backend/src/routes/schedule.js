import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { getSchedule } from '../services/schedule.js';
import { applyScheduleChanges } from '../services/scheduleWrite.js';
import { copySchedule } from '../services/scheduleCopy.js';

export const scheduleRouter = Router();

// 排班日曆資料：events（事件）與 resources（客戶列或員工列）。dimension：overview／customer／employee
scheduleRouter.get('/schedule', requireAuth, requirePermission('schedule:view'),
  asyncHandler(async (req, res) => ok(res, await getSchedule(req.user, req.query))));

// 批次排班：changes 為 add／update／remove，全部成功才寫入。需要 schedule:edit，每種變更另需對應的任務權限
scheduleRouter.patch('/schedule', requireAuth, requirePermission('schedule:edit'),
  asyncHandler(async (req, res) => {
    const result = await applyScheduleChanges(req.user, req.body);
    ok(res, result, `已套用 ${result.applied} 筆變更`);
  }));

// 複製班表：把來源區間的任務平移到目標區間（不帶指派人員，複製出來是未排班）。需要 schedule:edit 與 task:create
scheduleRouter.post('/schedule/copy', requireAuth, requirePermission('schedule:edit'),
  asyncHandler(async (req, res) => {
    const result = await copySchedule(req.user, req.body);
    ok(res, result, `已複製 ${result.copiedCount} 筆任務`);
  }));
