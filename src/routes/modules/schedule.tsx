/**
 * 班表模組路由設定
 *
 * 定義 /schedule 路由，需具備 schedule:view 權限才能進入。
 */
import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteGuard } from '@/routes/guards';

const SchedulePage = lazy(() => import('@/pages/schedule/index'));

export const scheduleRoutes: RouteObject[] = [
  {
    path: '/schedule',
    element: (
      <RouteGuard requiredPermissions={['schedule:view']}>
        <SchedulePage />
      </RouteGuard>
    ),
  },
];
