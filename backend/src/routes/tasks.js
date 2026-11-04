import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { listTasks, getTask } from '../services/tasks.js';
import { createTask, updateTask } from '../services/taskWrite.js';

export const tasksRouter = Router();

tasksRouter.get('/tasks', requireAuth, requirePermission('task:view'),
  asyncHandler(async (req, res) => ok(res, await listTasks(req.user, req.query))));

tasksRouter.get('/tasks/:id', requireAuth, requirePermission('task:view'),
  asyncHandler(async (req, res) => ok(res, await getTask(req.user, req.params.id))));

tasksRouter.post('/tasks', requireAuth, requirePermission('task:create'),
  asyncHandler(async (req, res) => ok(res, await createTask(req.user, req.body))));

// 修改任務；取消任務也是這支（body 帶 status: "CANCELLED"，可一併帶 remarks 當取消原因）
tasksRouter.patch('/tasks/:id', requireAuth, requirePermission('task:edit'),
  asyncHandler(async (req, res) => ok(res, await updateTask(req.user, req.params.id, req.body))));
