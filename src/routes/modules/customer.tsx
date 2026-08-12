import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteGuard } from '@/routes/guards';

const CustomerPage = lazy(() => import('@/pages/customer/index'));

export const customerRoutes: RouteObject[] = [
  {
    path: '/customer',
    element: (
      <RouteGuard requiredPermissions={['customer:view']}>
        <CustomerPage />
      </RouteGuard>
    ),
  },
];
