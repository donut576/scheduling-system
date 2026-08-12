import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteGuard } from '@/routes/guards';

const PendingCustomerPage = lazy(() => import('@/pages/pending-customer/index'));

export const pendingCustomerRoutes: RouteObject[] = [
  {
    path: '/pending-customer',
    element: (
      <RouteGuard requiredPermissions={['pending_customer:view']}>
        <PendingCustomerPage />
      </RouteGuard>
    ),
  },
];
