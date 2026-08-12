import { create } from 'zustand';
import type { RoleType } from '@/types/auth';
import type { MenuItem, RouteConfig } from '@/types/common';
import { ROLE_PERMISSIONS } from '@/constants/permissions';

interface PermissionState {
  accessibleRoutes: RouteConfig[];
  menuTree: MenuItem[];
  permissionCodes: Set<string>;

  // Actions
  buildPermissions: (permissions: string[], role: RoleType) => void;
  hasPermission: (code: string) => boolean;
  hasRole: (role: RoleType) => boolean;
  reset: () => void;
}

// Full menu configuration - will be filtered by permissions
export const FULL_MENU: MenuItem[] = [
  { key: '/dashboard', label: '儀表板', permission: undefined },
  { key: '/task', label: '任務管理', permission: 'task:view' },
  { key: '/schedule', label: '班表總覽', permission: 'schedule:view' },
  { key: '/customer', label: '客戶資料', permission: 'customer:view' },
  { key: '/employee', label: '員工資料', permission: 'employee:view' },
  { key: '/notification', label: '通知管理', permission: 'notification:view' },
  { key: '/approval', label: '異動核准', permission: 'approval:view' },
  { key: '/pending-customer', label: '待排時間客戶', permission: 'pending_customer:view' },
  { key: '/map', label: '地圖檢視', permission: 'map:view' },
];

// Full route configuration
const FULL_ROUTES: RouteConfig[] = [
  { path: '/dashboard', permission: undefined, meta: { title: '儀表板' } },
  { path: '/task', permission: 'task:view', meta: { title: '任務管理' } },
  { path: '/schedule', permission: 'schedule:view', meta: { title: '班表總覽' } },
  { path: '/customer', permission: 'customer:view', meta: { title: '客戶資料' } },
  { path: '/employee', permission: 'employee:view', meta: { title: '員工資料' } },
  { path: '/notification', permission: 'notification:view', meta: { title: '通知管理' } },
  { path: '/approval', permission: 'approval:view', meta: { title: '異動核准' } },
  {
    path: '/pending-customer',
    permission: 'pending_customer:view',
    meta: { title: '待排時間客戶' },
  },
  { path: '/map', permission: 'map:view', meta: { title: '地圖檢視' } },
];

export const usePermissionStore = create<PermissionState>((set, get) => ({
  accessibleRoutes: [],
  menuTree: [],
  permissionCodes: new Set<string>(),

  buildPermissions: (permissions: string[], role: RoleType) => {
    // Merge API permissions with role-based defaults
    const rolePerms = ROLE_PERMISSIONS[role] || [];
    const allPerms = new Set([...permissions, ...rolePerms]);

    // Filter routes by permission
    const accessibleRoutes = FULL_ROUTES.filter(
      (route) => !route.permission || allPerms.has(route.permission),
    );

    // Filter menu by permission
    const menuTree = FULL_MENU.filter((item) => !item.permission || allPerms.has(item.permission));

    set({
      permissionCodes: allPerms,
      accessibleRoutes,
      menuTree,
    });
  },

  hasPermission: (code: string) => get().permissionCodes.has(code),

  hasRole: (_role: RoleType) => {
    // This would typically check against the user store
    return false; // Placeholder - will be used with useUserStore.user.role
  },

  reset: () => set({ accessibleRoutes: [], menuTree: [], permissionCodes: new Set() }),
}));
