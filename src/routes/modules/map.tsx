/**
 * 地圖模組路由設定
 *
 * 定義 /map 路由，需具備 map:view 權限才能進入。
 */
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
