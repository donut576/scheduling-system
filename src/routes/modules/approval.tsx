/**
 * 簽核模組路由設定
 *
 * 定義 /approval 路由，需具備 approval:view 權限才能進入。
 */
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
