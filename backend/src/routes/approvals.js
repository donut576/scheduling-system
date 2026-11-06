import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { listApprovals, approve, reject, withdraw } from '../services/approvals.js';

// 異動核准：目前只有「證照不符」的排班特許要核准。核准／駁回由經理（副總）、管理員處理。
export const approvalsRouter = Router();

approvalsRouter.get('/approvals', requireAuth, requirePermission('approval:view'),
  asyncHandler(async (req, res) => ok(res, await listApprovals(req.user, req.query))));

approvalsRouter.post('/approvals/:id/approve', requireAuth, requirePermission('approval:approve'),
  asyncHandler(async (req, res) => ok(res, await approve(req.user, req.params.id, req.body))));

approvalsRouter.post('/approvals/:id/reject', requireAuth, requirePermission('approval:approve'),
  asyncHandler(async (req, res) => ok(res, await reject(req.user, req.params.id, req.body))));

// 撤回：申請人本人（或有核准權限的人）；本人檢查在 service 裡
approvalsRouter.post('/approvals/:id/withdraw', requireAuth, requirePermission('approval:view'),
  asyncHandler(async (req, res) => ok(res, await withdraw(req.user, req.params.id))));
