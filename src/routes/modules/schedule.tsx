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
