import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { listEmployees, getEmployee } from '../services/employees.js';
import { createEmployee, updateEmployee } from '../services/employeeWrite.js';
import { disableEmployee } from '../services/employeeDisable.js';
import { resetEmployeePassword } from '../services/employeePassword.js';

export const employeesRouter = Router();

employeesRouter.get('/employees', requireAuth, requirePermission('employee:view'),
  asyncHandler(async (req, res) => ok(res, await listEmployees(req.user, req.query))));

employeesRouter.get('/employees/:id', requireAuth, requirePermission('employee:view'),
  asyncHandler(async (req, res) => ok(res, await getEmployee(req.user, req.params.id))));

employeesRouter.post('/employees', requireAuth, requirePermission('employee:create'),
  asyncHandler(async (req, res) => ok(res, await createEmployee(req.user, req.body), '員工已建立')));

employeesRouter.patch('/employees/:id', requireAuth, requirePermission('employee:edit'),
  asyncHandler(async (req, res) => ok(res, await updateEmployee(req.user, req.params.id, req.body), '員工已更新')));

employeesRouter.delete('/employees/:id', requireAuth, requirePermission('employee:delete'),
  asyncHandler(async (req, res) => ok(res, await disableEmployee(req.user, req.params.id), '員工已停用')));

employeesRouter.post('/employees/:id/reset-password', requireAuth, requirePermission('employee:reset_password'),
  asyncHandler(async (req, res) => ok(res, await resetEmployeePassword(req.params.id), '密碼已重設為預設密碼，員工下次登入需變更密碼')));