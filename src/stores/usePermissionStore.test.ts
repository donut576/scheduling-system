import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { usePermissionStore } from './usePermissionStore';
import { ROLE_PERMISSIONS } from '@/constants/permissions';
import type { RoleType } from '@/types/auth';

/**
 * Property 3: 角色路由生成正確性
 * For any RoleType, the generated accessible routes are a valid subset of the global route table,
 * and every menu tree node has a corresponding route definition.
 *
 * **Validates: Requirements 2.1**
 */

// All valid RoleType values
const ALL_ROLES: RoleType[] = [
  'ADMIN',
  'ADMIN_STAFF',
  'MANAGER',
  'DIRECTOR',
  'LEADER',
  'STAFF',
  'SALES_OPS',
];

// The full route table as defined in usePermissionStore (global route table)
const FULL_ROUTES_PATHS = [
  '/dashboard',
  '/task',
  '/schedule',
  '/customer',
  '/employee',
  '/notification',
  '/approval',
  '/pending-customer',
  '/map',
];

// Arbitrary for RoleType
const arbRoleType = fc.constantFrom(...ALL_ROLES);

// Arbitrary for additional permission codes (simulating API-provided permissions)
const ALL_PERMISSION_CODES = Object.values(
  Object.fromEntries(
    Object.entries(ROLE_PERMISSIONS).flatMap(([, perms]) => perms.map((p) => [p, p])),
  ),
);

const arbPermissions = fc.subarray(ALL_PERMISSION_CODES, { minLength: 0 });

describe('usePermissionStore - Property 3: 角色路由生成正確性', () => {
  beforeEach(() => {
    usePermissionStore.getState().reset();
  });

  it('for any RoleType, accessible routes are a valid subset of the global route table', () => {
    fc.assert(
      fc.property(arbRoleType, arbPermissions, (role, permissions) => {
        // Reset store state
        usePermissionStore.getState().reset();

        // Build permissions for the given role
        usePermissionStore.getState().buildPermissions(permissions, role);

        const { accessibleRoutes } = usePermissionStore.getState();

        // Every accessible route's path must be in the full route table
        for (const route of accessibleRoutes) {
          expect(FULL_ROUTES_PATHS).toContain(route.path);
        }

        // Accessible routes must be a subset (count <= full table)
        expect(accessibleRoutes.length).toBeLessThanOrEqual(FULL_ROUTES_PATHS.length);
      }),
      { numRuns: 100 },
    );
  });

  it('for any RoleType, every menu tree node has a corresponding route definition', () => {
    fc.assert(
      fc.property(arbRoleType, arbPermissions, (role, permissions) => {
        // Reset store state
        usePermissionStore.getState().reset();

        // Build permissions for the given role
        usePermissionStore.getState().buildPermissions(permissions, role);

        const { accessibleRoutes, menuTree } = usePermissionStore.getState();

        // Extract paths from accessible routes
        const accessiblePaths = new Set(accessibleRoutes.map((r) => r.path));

        // Every menu tree node's key should correspond to an accessible route path
        for (const menuItem of menuTree) {
          expect(accessiblePaths.has(menuItem.key)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('for any RoleType, accessible routes are non-empty (at minimum /dashboard is accessible)', () => {
    fc.assert(
      fc.property(arbRoleType, (role) => {
        // Reset store state
        usePermissionStore.getState().reset();

        // Build permissions with role defaults (no extra API permissions)
        usePermissionStore.getState().buildPermissions([], role);

        const { accessibleRoutes } = usePermissionStore.getState();

        // Dashboard has no permission requirement, so it should always be accessible
        expect(accessibleRoutes.length).toBeGreaterThanOrEqual(1);
        expect(accessibleRoutes.some((r) => r.path === '/dashboard')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 5: 權限代碼 UI 控制
 * For any 權限代碼集合，受保護 UI 元素之顯示狀態與權限代碼存在性完全對應。
 * That is: hasPermission(code) returns true iff the code is present in the permission set.
 *
 * **Validates: Requirements 2.3**
 */

// All known permission codes in the system
const ALL_KNOWN_PERMISSIONS = [
  'task:view',
  'task:create',
  'task:edit',
  'task:delete',
  'task:export',
  'task:override_alert',
  'schedule:view',
  'schedule:edit',
  'schedule:approve',
  'customer:view',
  'customer:create',
  'customer:edit',
  'customer:delete',
  'employee:view',
  'employee:create',
  'employee:edit',
  'employee:designate_leave',
  'notification:view',
  'notification:send',
  'notification:manage_template',
  'approval:view',
  'approval:approve',
  'pending_customer:view',
  'pending_customer:create',
  'pending_customer:convert',
  'map:view',
  'system:audit',
  'system:settings',
];

// Arbitrary for a subset of permission codes (simulating a user's granted permissions)
const arbPermissionSubset = fc.subarray(ALL_KNOWN_PERMISSIONS, { minLength: 0 });

describe('usePermissionStore - Property 5: 權限代碼 UI 控制', () => {
  beforeEach(() => {
    usePermissionStore.getState().reset();
  });

  it('for any permission code set, hasPermission returns true for codes in the set and false for codes not in the set', () => {
    fc.assert(
      fc.property(arbPermissionSubset, (grantedPermissions) => {
        // Reset store state
        usePermissionStore.getState().reset();

        // Build permissions with the granted codes and a minimal role (STAFF has few permissions)
        // We pass grantedPermissions as the API permissions; use ADMIN role to ensure
        // role-based defaults don't interfere, then override: pass STAFF (minimal) so
        // the final set is role-based + API permissions. For a cleaner test of the pure
        // hasPermission logic, we use 'STAFF' role which has minimal permissions, and
        // compute the expected full set.
        const role: RoleType = 'STAFF';
        usePermissionStore.getState().buildPermissions(grantedPermissions, role);

        // The effective permission set is the union of granted permissions and role defaults
        const roleDefaults = ROLE_PERMISSIONS[role] || [];
        const expectedPermissions = new Set([...grantedPermissions, ...roleDefaults]);

        // Verify: for every known permission code, hasPermission matches membership in expectedPermissions
        for (const code of ALL_KNOWN_PERMISSIONS) {
          const result = usePermissionStore.getState().hasPermission(code);
          const expected = expectedPermissions.has(code);
          expect(result).toBe(expected);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('for any role and permission code set, hasPermission is consistent with the built permission set', () => {
    fc.assert(
      fc.property(arbRoleType, arbPermissionSubset, (role, grantedPermissions) => {
        // Reset store state
        usePermissionStore.getState().reset();

        // Build permissions with the given role and API-provided permission codes
        usePermissionStore.getState().buildPermissions(grantedPermissions, role);

        // The effective permission set = union of API permissions and role defaults
        const roleDefaults = ROLE_PERMISSIONS[role] || [];
        const expectedPermissions = new Set([...grantedPermissions, ...roleDefaults]);

        // Verify: hasPermission returns true iff code is in expectedPermissions
        for (const code of ALL_KNOWN_PERMISSIONS) {
          expect(usePermissionStore.getState().hasPermission(code)).toBe(
            expectedPermissions.has(code),
          );
        }
      }),
      { numRuns: 100 },
    );
  });

  it('for any permission code set, codes NOT in the granted set are correctly hidden (hasPermission returns false)', () => {
    fc.assert(
      fc.property(arbPermissionSubset, (grantedPermissions) => {
        // Reset store state
        usePermissionStore.getState().reset();

        // Use a role with no default permissions to isolate the test
        // Since all roles have some defaults, we pass the granted set directly
        // and use STAFF to keep the noise low
        const role: RoleType = 'STAFF';
        usePermissionStore.getState().buildPermissions(grantedPermissions, role);

        const roleDefaults = ROLE_PERMISSIONS[role] || [];
        const effectiveSet = new Set([...grantedPermissions, ...roleDefaults]);

        // Compute the complement: codes NOT in the effective set
        const deniedCodes = ALL_KNOWN_PERMISSIONS.filter((code) => !effectiveSet.has(code));

        // All denied codes should return false from hasPermission
        for (const code of deniedCodes) {
          expect(usePermissionStore.getState().hasPermission(code)).toBe(false);
        }

        // All granted codes should return true from hasPermission
        for (const code of Array.from(effectiveSet)) {
          expect(usePermissionStore.getState().hasPermission(code)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
