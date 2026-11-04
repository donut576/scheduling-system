import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { listCustomers, listCustomerGroups } from '../services/customers.js';

export const customersRouter = Router();

customersRouter.get('/customers', requireAuth, requirePermission('customer:view'),
  asyncHandler(async (req, res) => ok(res, await listCustomers(req.user, req.query))));

customersRouter.get('/customers/groups', requireAuth, requirePermission('customer:view'),
  asyncHandler(async (req, res) => ok(res, await listCustomerGroups(req.user))));
