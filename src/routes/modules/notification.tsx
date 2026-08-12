import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteGuard } from '@/routes/guards';

const NotificationPage = lazy(() => import('@/pages/notification/index'));

export const notificationRoutes: RouteObject[] = [
  {
    path: '/notification',
    element: (
      <RouteGuard requiredPermissions={['notification:view']}>
        <NotificationPage />
      </RouteGuard>
    ),
  },
];
