import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { listPending, updatePending, convertPending, deletePending } from '../services/pending.js';

// 待排任務 = 狀態為「未排班」的任務（見 services/pending.js）。沒有新增：任務表單存成未排班就會出現。
export const pendingRouter = Router();

pendingRouter.get('/pending-customers', requireAuth, requirePermission('pending_customer:view'),
  asyncHandler(async (req, res) => ok(res, await listPending(req.user, req.query))));

// 修改沒有獨立的權限代碼，沿用「新增」的權限
pendingRouter.patch('/pending-customers/:id', requireAuth, requirePermission('pending_customer:create'),
  asyncHandler(async (req, res) => ok(res, await updatePending(req.user, req.params.id, req.body))));

// 排定：補上日期與時間（人員足夠）後任務變成已排班，回傳該任務
pendingRouter.post('/pending-customers/:id/convert', requireAuth, requirePermission('pending_customer:convert'),
  asyncHandler(async (req, res) => ok(res, await convertPending(req.user, req.params.id, req.body))));

// 刪除 = 取消任務
pendingRouter.delete('/pending-customers/:id', requireAuth, requirePermission('pending_customer:delete'),
  asyncHandler(async (req, res) => ok(res, await deletePending(req.user, req.params.id))));
