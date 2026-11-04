import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { listEmployees, getEmployee } from '../services/employees.js';

export const employeesRouter = Router();

employeesRouter.get('/employees', requireAuth, requirePermission('employee:view'),
  asyncHandler(async (req, res) => ok(res, await listEmployees(req.user, req.query))));

employeesRouter.get('/employees/:id', requireAuth, requirePermission('employee:view'),
  asyncHandler(async (req, res) => ok(res, await getEmployee(req.user, req.params.id))));
