/**
 * 客戶模組路由設定
 *
 * 定義 /customer 路由，需具備 customer:view 權限才能進入。
 */
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
