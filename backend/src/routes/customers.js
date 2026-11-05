import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { listCustomers, listCustomerGroups } from '../services/customers.js';
import { createCustomer, updateCustomer, disableCustomer } from '../services/customerWrite.js';

export const customersRouter = Router();

customersRouter.get('/customers', requireAuth, requirePermission('customer:view'),
  asyncHandler(async (req, res) => ok(res, await listCustomers(req.user, req.query))));

customersRouter.get('/customers/groups', requireAuth, requirePermission('customer:view'),
  asyncHandler(async (req, res) => ok(res, await listCustomerGroups(req.user))));

customersRouter.post('/customers', requireAuth, requirePermission('customer:create'),
  asyncHandler(async (req, res) => ok(res, await createCustomer(req.user, req.body), '客戶已建立')));

customersRouter.patch('/customers/:id', requireAuth, requirePermission('customer:edit'),
  asyncHandler(async (req, res) => ok(res, await updateCustomer(req.user, req.params.id, req.body), '客戶已更新')));

customersRouter.delete('/customers/:id', requireAuth, requirePermission('customer:delete'),
  asyncHandler(async (req, res) => ok(res, await disableCustomer(req.user, req.params.id), '客戶已停用')));
