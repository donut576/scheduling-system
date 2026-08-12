/**
 * 待審客戶模組路由設定
 *
 * 定義 /pending-customer 路由，需具備 pending_customer:view 權限才能進入。
 */
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
