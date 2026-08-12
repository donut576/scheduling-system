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
