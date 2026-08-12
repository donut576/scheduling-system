/**
 * 路由守衛（Route Guard）
 *
 * 提供 RouteGuard 元件，用於在渲染受保護頁面前檢查登入狀態、角色與權限，
 * 若條件不符則導向 /login 或 /403。
 */
import type { FC, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { RoleType } from '@/types/auth';
import { useUserStore } from '@/stores/useUserStore';
import { usePermissionStore } from '@/stores/usePermissionStore';

export interface RouteGuardProps {
  /** 需具備的權限代碼清單，全部滿足才可通過（AND 條件） */
  requiredPermissions?: string[];
  /** 允許存取的角色清單，使用者角色需在此清單中才可通過 */
  requiredRoles?: RoleType[];
  children: ReactNode;
}

/**
 * Route guard component that checks authentication, role, and permission.
 * - Redirects to /login if no token
 * - Redirects to /403 if role is not allowed
 * - Redirects to /403 if required permissions are not met
 */
export const RouteGuard: FC<RouteGuardProps> = ({
  requiredPermissions,
  requiredRoles,
  children,
}) => {
  const token = useUserStore((state) => state.token);
  const user = useUserStore((state) => state.user);
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  // 第一步：檢查是否已登入（有 token），未登入導向登入頁
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // 第二步：若指定 requiredRoles，檢查使用者角色是否在允許清單內
  if (requiredRoles && requiredRoles.length > 0) {
    const userRole = user?.role;
    if (!userRole || !requiredRoles.includes(userRole)) {
      return <Navigate to="/403" replace />;
    }
  }

  // 第三步：若指定 requiredPermissions，需全部權限都滿足（AND 條件）才可通過
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every((code) => hasPermission(code));
    if (!hasAllPermissions) {
      return <Navigate to="/403" replace />;
    }
  }

  // 全部檢查通過，渲染實際的受保護內容
  return <>{children}</>;
};
