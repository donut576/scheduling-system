/**
 * 任務模組路由設定
 *
 * 定義 /task 路由，需具備 task:view 權限才能進入。
 */
import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteGuard } from '@/routes/guards';

const TaskPage = lazy(() => import('@/pages/task/index'));

export const taskRoutes: RouteObject[] = [
  {
    path: '/task',
    element: (
      <RouteGuard requiredPermissions={['task:view']}>
        <TaskPage />
      </RouteGuard>
    ),
  },
];
