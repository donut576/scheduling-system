import type { FC, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { RoleType } from '@/types/auth';
import { useUserStore } from '@/stores/useUserStore';
import { usePermissionStore } from '@/stores/usePermissionStore';

export interface RouteGuardProps {
  requiredPermissions?: string[];
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

  // Check token exists
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Check role is allowed
  if (requiredRoles && requiredRoles.length > 0) {
    const userRole = user?.role;
    if (!userRole || !requiredRoles.includes(userRole)) {
      return <Navigate to="/403" replace />;
    }
  }

  // Check required permissions
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every((code) => hasPermission(code));
    if (!hasAllPermissions) {
      return <Navigate to="/403" replace />;
    }
  }

  return <>{children}</>;
};
