import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { listTasks, getTask } from '../services/tasks.js';

export const tasksRouter = Router();

tasksRouter.get('/tasks', requireAuth, requirePermission('task:view'),
  asyncHandler(async (req, res) => ok(res, await listTasks(req.user, req.query))));

tasksRouter.get('/tasks/:id', requireAuth, requirePermission('task:view'),
  asyncHandler(async (req, res) => ok(res, await getTask(req.user, req.params.id))));
