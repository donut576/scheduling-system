import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, requireAnyPermission } from '../middleware/permission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { listTasks, getTask } from '../services/tasks.js';
import { createTask, updateTask } from '../services/taskWrite.js';
import { validateTask, overrideWarning } from '../services/alertApi.js';

export const tasksRouter = Router();

// 讀取任務：有「任務管理」(task:view) 或「班表檢視」(schedule:view) 即可。
// 只有班表檢視權限的人（一般員工）只看得到已排班的任務，看不到待排與已取消。
const READ_TASK = requireAnyPermission(['task:view', 'schedule:view']);

tasksRouter.get('/tasks', requireAuth, READ_TASK,
  asyncHandler(async (req, res) => ok(res, await listTasks(req.user, req.query))));

// 排班警示預檢：只檢查、不寫入。/tasks/validate 給新增用（還沒有 id），必須排在 /tasks/:id 之前
tasksRouter.post('/tasks/validate', requireAuth, requirePermission('task:create'),
  asyncHandler(async (req, res) => ok(res, await validateTask(req.user, null, req.body))));

tasksRouter.post('/tasks/:id/validate', requireAuth, requirePermission('task:edit'),
  asyncHandler(async (req, res) => ok(res, await validateTask(req.user, req.params.id, req.body))));

// 對已存在、目前有警示的任務補上特許備註（需要特許權限）
tasksRouter.post('/tasks/:id/override-warning', requireAuth, requirePermission('task:override_alert'),
  asyncHandler(async (req, res) => ok(res, await overrideWarning(req.user, req.params.id, req.body?.remark))));

tasksRouter.get('/tasks/:id', requireAuth, READ_TASK,
  asyncHandler(async (req, res) => ok(res, await getTask(req.user, req.params.id))));

tasksRouter.post('/tasks', requireAuth, requirePermission('task:create'),
  asyncHandler(async (req, res) => ok(res, await createTask(req.user, req.body))));

// 修改任務；取消任務也是這支（body 帶 status: "CANCELLED"，可一併帶 remarks 當取消原因）
tasksRouter.patch('/tasks/:id', requireAuth, requirePermission('task:edit'),
  asyncHandler(async (req, res) => ok(res, await updateTask(req.user, req.params.id, req.body))));
