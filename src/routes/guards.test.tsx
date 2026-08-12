import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RouteGuard } from './guards';
import { useUserStore } from '@/stores/useUserStore';
import { usePermissionStore } from '@/stores/usePermissionStore';

// Helper to render RouteGuard inside a router context with target routes
function renderWithRouter(
  guardProps: {
    requiredPermissions?: string[];
    requiredRoles?: ('ADMIN' | 'ADMIN_STAFF' | 'MANAGER' | 'LEADER' | 'STAFF')[];
  },
  initialPath = '/protected',
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <RouteGuard {...guardProps}>
              <div>Protected Content</div>
            </RouteGuard>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/403" element={<div>Forbidden Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RouteGuard', () => {
  beforeEach(() => {
    // Reset stores
    useUserStore.setState({ token: null, user: null, loginFailCount: 0 });
    usePermissionStore.getState().reset();
  });

  it('redirects to /login when no token is present', () => {
    renderWithRouter({});
    expect(screen.getByText('Login Page')).toBeDefined();
  });

  it('renders children when token exists and no role/permission required', () => {
    useUserStore.setState({
      token: 'valid-token',
      user: {
        id: '1',
        name: 'Test',
        employeeNo: 'E001',
        role: 'STAFF',
        permissions: [],
        groupId: undefined,
      },
    });
    renderWithRouter({});
    expect(screen.getByText('Protected Content')).toBeDefined();
  });

  it('redirects to /403 when user role is not in requiredRoles', () => {
    useUserStore.setState({
      token: 'valid-token',
      user: {
        id: '1',
        name: 'Test',
        employeeNo: 'E001',
        role: 'STAFF',
        permissions: [],
        groupId: undefined,
      },
    });
    renderWithRouter({ requiredRoles: ['ADMIN', 'MANAGER'] });
    expect(screen.getByText('Forbidden Page')).toBeDefined();
  });

  it('renders children when user role is in requiredRoles', () => {
    useUserStore.setState({
      token: 'valid-token',
      user: {
        id: '1',
        name: 'Test',
        employeeNo: 'E001',
        role: 'ADMIN',
        permissions: [],
        groupId: undefined,
      },
    });
    renderWithRouter({ requiredRoles: ['ADMIN', 'MANAGER'] });
    expect(screen.getByText('Protected Content')).toBeDefined();
  });

  it('redirects to /403 when required permissions are not met', () => {
    useUserStore.setState({
      token: 'valid-token',
      user: {
        id: '1',
        name: 'Test',
        employeeNo: 'E001',
        role: 'STAFF',
        permissions: [],
        groupId: undefined,
      },
    });
    // permissionCodes is empty, so hasPermission will return false
    renderWithRouter({ requiredPermissions: ['task:view'] });
    expect(screen.getByText('Forbidden Page')).toBeDefined();
  });

  it('renders children when all required permissions are met', () => {
    useUserStore.setState({
      token: 'valid-token',
      user: {
        id: '1',
        name: 'Test',
        employeeNo: 'E001',
        role: 'STAFF',
        permissions: ['task:view'],
        groupId: undefined,
      },
    });
    usePermissionStore.getState().buildPermissions(['task:view', 'schedule:view'], 'STAFF');
    renderWithRouter({ requiredPermissions: ['task:view'] });
    expect(screen.getByText('Protected Content')).toBeDefined();
  });

  it('redirects to /403 when only some required permissions are met', () => {
    useUserStore.setState({
      token: 'valid-token',
      user: {
        id: '1',
        name: 'Test',
        employeeNo: 'E001',
        role: 'STAFF',
        permissions: ['task:view'],
        groupId: undefined,
      },
    });
    usePermissionStore.getState().buildPermissions(['task:view'], 'STAFF');
    renderWithRouter({ requiredPermissions: ['task:view', 'task:create'] });
    expect(screen.getByText('Forbidden Page')).toBeDefined();
  });
});

import fc from 'fast-check';
import { PERMISSIONS, ROLE_PERMISSIONS } from '@/constants/permissions';
import type { RoleType } from '@/types/auth';

/**
 * Property 4: 未授權路由阻擋
 * For any 角色與不在可存取清單中之路徑，路由守衛導向 403
 *
 * **Validates: Requirements 2.2**
 */

const ALL_ROLES: RoleType[] = ['ADMIN', 'ADMIN_STAFF', 'MANAGER', 'LEADER', 'STAFF'];

const ALL_PERMISSION_CODES = Object.values(PERMISSIONS);

// Arbitrary for RoleType
const arbRoleType = fc.constantFrom(...ALL_ROLES);

describe('RouteGuard - Property 4: 未授權路由阻擋', () => {
  beforeEach(() => {
    useUserStore.setState({ token: null, user: null, loginFailCount: 0 });
    usePermissionStore.getState().reset();
  });

  it('for any role and required permissions NOT in the user permission set, RouteGuard redirects to /403', () => {
    fc.assert(
      fc.property(
        arbRoleType,
        fc.array(fc.constantFrom(...ALL_PERMISSION_CODES), { minLength: 1, maxLength: 5 }),
        (role, requiredPermissions) => {
          // Build permissions for the role (the user's actual permissions)
          const rolePerms = ROLE_PERMISSIONS[role] || [];

          // Filter to only keep required permissions that are NOT in the role's permission set
          // We need at least one permission that the user does NOT have
          const unauthorizedPermissions = requiredPermissions.filter((p) => !rolePerms.includes(p));

          // Skip if all required permissions happen to be in the role's set (not an unauthorized case)
          if (unauthorizedPermissions.length === 0) return;

          // Set up store state: user is authenticated with the given role
          useUserStore.setState({
            token: 'valid-token',
            user: {
              id: '1',
              name: 'Test User',
              employeeNo: 'E001',
              role,
              permissions: [],
              groupId: undefined,
            },
            loginFailCount: 0,
          });

          // Build permission store with role-based permissions only (no extra API permissions)
          usePermissionStore.getState().buildPermissions([], role);

          // Render with required permissions that include at least one the user doesn't have
          const { unmount } = render(
            <MemoryRouter initialEntries={['/protected']}>
              <Routes>
                <Route
                  path="/protected"
                  element={
                    <RouteGuard requiredPermissions={requiredPermissions}>
                      <div>Protected Content</div>
                    </RouteGuard>
                  }
                />
                <Route path="/403" element={<div>Forbidden Page</div>} />
              </Routes>
            </MemoryRouter>,
          );

          // Should redirect to 403 since user lacks at least one required permission
          expect(screen.getByText('Forbidden Page')).toBeDefined();
          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('for any role and requiredRoles that exclude the user role, RouteGuard redirects to /403', () => {
    fc.assert(
      fc.property(
        arbRoleType,
        fc.subarray(ALL_ROLES, { minLength: 1, maxLength: ALL_ROLES.length - 1 }),
        (userRole, requiredRoles) => {
          // Only test when the user's role is NOT in the required roles list
          if (requiredRoles.includes(userRole)) return;

          // Set up store state: user is authenticated with the given role
          useUserStore.setState({
            token: 'valid-token',
            user: {
              id: '1',
              name: 'Test User',
              employeeNo: 'E001',
              role: userRole,
              permissions: [],
              groupId: undefined,
            },
            loginFailCount: 0,
          });

          usePermissionStore.getState().buildPermissions([], userRole);

          const { unmount } = render(
            <MemoryRouter initialEntries={['/protected']}>
              <Routes>
                <Route
                  path="/protected"
                  element={
                    <RouteGuard requiredRoles={requiredRoles}>
                      <div>Protected Content</div>
                    </RouteGuard>
                  }
                />
                <Route path="/403" element={<div>Forbidden Page</div>} />
              </Routes>
            </MemoryRouter>,
          );

          // Should redirect to 403 since user role is not in requiredRoles
          expect(screen.getByText('Forbidden Page')).toBeDefined();
          unmount();
        },
      ),
      { numRuns: 100 },
    );
  });
});
