import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { RouteGuard } from '@/routes/guards';
import PageErrorBoundary from '@/components/base/PageErrorBoundary';
import RouteLoadingIndicator from '@/components/base/RouteLoadingIndicator';
import MainLayout from '@/components/layout/MainLayout';
import { taskRoutes } from '@/routes/modules/task';
import { scheduleRoutes } from '@/routes/modules/schedule';
import { customerRoutes } from '@/routes/modules/customer';
import { employeeRoutes } from '@/routes/modules/employee';
import { notificationRoutes } from '@/routes/modules/notification';
import { approvalRoutes } from '@/routes/modules/approval';
import { pendingCustomerRoutes } from '@/routes/modules/pending-customer';
import { mapRoutes } from '@/routes/modules/map';

// Lazy loaded pages
const LoginPage = lazy(() => import('@/pages/login/index'));
const DashboardPage = lazy(() => import('@/pages/dashboard/index'));
const ForbiddenPage = lazy(() => import('@/pages/403'));

/**
 * Suspense + Error Boundary wrapper for lazy loaded route components.
 * - Suspense provides a loading fallback while the component chunk is being fetched.
 * - PageErrorBoundary catches rendering errors within the page and shows a
 *   fallback UI with a reload button instead of crashing the whole app.
 */
const LazyLoad = ({ children }: { children: React.ReactNode }) => (
  <PageErrorBoundary>
    <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>載入中...</div>}>
      {children}
    </Suspense>
  </PageErrorBoundary>
);

/**
 * RootLayout - 根路由元件
 *
 * 渲染 RouteLoadingIndicator（監控 useNavigation() 以顯示全域路由載入指示器）
 * 與 Outlet（渲染實際匹配的子路由）。所有路由皆為此根路由的子路由，確保任何
 * 路由切換都會經過此層並觸發全域載入指示器，包含 /login、/403 與所有受保護頁面。
 *
 * Validates: Requirements 17.3
 */
const RootLayout = () => (
  <>
    <RouteLoadingIndicator />
    <Outlet />
  </>
);

/**
 * 受保護模組路由（皆需登入且巢狀於 MainLayout 之下，確保 Sidebar/Header/Tabs
 * 在頁面切換時維持不變，僅 Content 區域的 Outlet 隨路由更新）。
 *
 * Validates: Requirements 2.1
 */
const protectedChildRoutes: RouteObject[] = [
  {
    path: '/dashboard',
    element: (
      <LazyLoad>
        <RouteGuard>
          <DashboardPage />
        </RouteGuard>
      </LazyLoad>
    ),
  },
  // Business module routes
  ...taskRoutes.map((route) => ({
    ...route,
    element: <LazyLoad>{route.element}</LazyLoad>,
  })),
  ...scheduleRoutes.map((route) => ({
    ...route,
    element: <LazyLoad>{route.element}</LazyLoad>,
  })),
  ...customerRoutes.map((route) => ({
    ...route,
    element: <LazyLoad>{route.element}</LazyLoad>,
  })),
  ...employeeRoutes.map((route) => ({
    ...route,
    element: <LazyLoad>{route.element}</LazyLoad>,
  })),
  ...notificationRoutes.map((route) => ({
    ...route,
    element: <LazyLoad>{route.element}</LazyLoad>,
  })),
  ...approvalRoutes.map((route) => ({
    ...route,
    element: <LazyLoad>{route.element}</LazyLoad>,
  })),
  ...pendingCustomerRoutes.map((route) => ({
    ...route,
    element: <LazyLoad>{route.element}</LazyLoad>,
  })),
  ...mapRoutes.map((route) => ({
    ...route,
    element: <LazyLoad>{route.element}</LazyLoad>,
  })),
];

/**
 * Full route configuration for the application.
 * - Public/standalone routes: /login, /403 (no MainLayout shell)
 * - Protected routes: all business pages, nested under the MainLayout layout
 *   route so Sidebar/Header/Tabs persist across navigations
 * - Default redirect: / → /dashboard
 */
const childRoutes: RouteObject[] = [
  {
    path: '/login',
    element: (
      <LazyLoad>
        <LoginPage />
      </LazyLoad>
    ),
  },
  {
    path: '/403',
    element: (
      <LazyLoad>
        <ForbiddenPage />
      </LazyLoad>
    ),
  },
  {
    element: <MainLayout />,
    children: protectedChildRoutes,
  },
  // Default redirect
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  // Catch-all: redirect unknown paths to dashboard
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
];

/**
 * Root route wraps all application routes with RootLayout so that
 * RouteLoadingIndicator is mounted once for the entire router tree.
 */
const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: childRoutes,
  },
];

export const router = createBrowserRouter(routes);

export default router;
