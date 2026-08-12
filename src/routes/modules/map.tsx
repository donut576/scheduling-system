import { lazy } from 'react';
import type { RouteObject } from 'react-router-dom';
import { RouteGuard } from '@/routes/guards';

const MapPage = lazy(() => import('@/pages/map/index'));

export const mapRoutes: RouteObject[] = [
  {
    path: '/map',
    element: (
      <RouteGuard requiredPermissions={['map:view']}>
        <MapPage />
      </RouteGuard>
    ),
  },
];
