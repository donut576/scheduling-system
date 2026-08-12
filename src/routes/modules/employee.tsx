/**
 * 員工模組路由設定
 *
 * 定義 /employee 路由，需具備 employee:view 權限才能進入。
 */
import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteGuard } from '@/routes/guards';

const EmployeePage = lazy(() => import('@/pages/employee/index'));

export const employeeRoutes: RouteObject[] = [
  {
    path: '/employee',
    element: (
      <RouteGuard requiredPermissions={['employee:view']}>
        <EmployeePage />
      </RouteGuard>
    ),
  },
];
