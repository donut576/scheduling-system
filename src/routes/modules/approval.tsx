import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteGuard } from '@/routes/guards';

const ApprovalPage = lazy(() => import('@/pages/approval/index'));

export const approvalRoutes: RouteObject[] = [
  {
    path: '/approval',
    element: (
      <RouteGuard requiredPermissions={['approval:view']}>
        <ApprovalPage />
      </RouteGuard>
    ),
  },
];
