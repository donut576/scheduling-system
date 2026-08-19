/**
 * 權限與路由/選單存取控制 store
 *
 * 根據使用者角色（role）與 API 授予之權限代碼，計算出可存取的路由清單、
 * 可顯示的選單樹，以及供 UI 元素判斷顯示與否的權限代碼集合。
 */
import { create } from 'zustand';
import type { RoleType } from '@/types/auth';
import type { MenuItem, RouteConfig } from '@/types/common';
import { ROLE_PERMISSIONS } from '@/constants/permissions';

interface PermissionState {
  /** 目前使用者可存取的路由清單 */
  accessibleRoutes: RouteConfig[];
  /** 依權限過濾後的選單樹 */
  menuTree: MenuItem[];
  /** 目前使用者擁有的權限代碼集合 */
  permissionCodes: Set<string>;

  // Actions
  /** 依 API 權限清單與角色，合併角色預設權限並重新計算可存取路由與選單 */
  buildPermissions: (permissions: string[], role: RoleType) => void;
  /** 判斷目前使用者是否擁有指定權限代碼 */
  hasPermission: (code: string) => boolean;
  /** 判斷目前使用者是否為指定角色（尚未實作，為預留介面） */
  hasRole: (role: RoleType) => boolean;
  /** 重置權限狀態（例如登出時使用） */
  reset: () => void;
}

/** 完整選單設定（尚未依權限過濾），buildPermissions 會依此列表篩選出使用者可見的選單 */
export const FULL_MENU: MenuItem[] = [
  { key: '/dashboard', label: '儀表板', permission: undefined },
  { key: '/task', label: '任務建立及一覽', permission: 'task:view' },
  { key: '/schedule', label: '班表總覽', permission: 'schedule:view' },
  { key: '/customer', label: '客戶資料管理', permission: 'customer:view' },
  { key: '/employee', label: '員工資料管理', permission: 'employee:view' },
  { key: '/notification', label: '通知管理', permission: 'notification:manage_template' },
  { key: '/approval', label: '異動核准', permission: 'approval:view', hideFromMenu: true },
  {
    key: '/pending-customer',
    label: '待排客戶',
    permission: 'pending_customer:view',
    hideFromMenu: true,
  },
  // 地圖檢視改以全域浮動按鈕（右下角）呈現，不再列於側邊選單
  { key: '/map', label: '地圖檢視', permission: 'map:view', hideFromMenu: true },
];

/** 完整路由設定（尚未依權限過濾），buildPermissions 會依此列表篩選出使用者可存取的路由 */
const FULL_ROUTES: RouteConfig[] = [
  { path: '/dashboard', permission: undefined, meta: { title: '儀表板' } },
  { path: '/task', permission: 'task:view', meta: { title: '任務建立及一覽' } },
  { path: '/schedule', permission: 'schedule:view', meta: { title: '班表總覽' } },
  { path: '/customer', permission: 'customer:view', meta: { title: '客戶資料管理' } },
  { path: '/employee', permission: 'employee:view', meta: { title: '員工資料管理' } },
  {
    path: '/notification',
    permission: 'notification:manage_template',
    meta: { title: '通知管理' },
  },
  { path: '/approval', permission: 'approval:view', meta: { title: '異動核准' } },
  {
    path: '/pending-customer',
    permission: 'pending_customer:view',
    meta: { title: '待排客戶' },
  },
  { path: '/map', permission: 'map:view', meta: { title: '地圖檢視' } },
];

/** 權限與路由/選單存取控制 store */
export const usePermissionStore = create<PermissionState>((set, get) => ({
  accessibleRoutes: [],
  menuTree: [],
  permissionCodes: new Set<string>(),

  buildPermissions: (permissions: string[], role: RoleType) => {
    // 將 API 回傳之權限與角色預設權限合併，取聯集作為最終有效權限集合
    const rolePerms = ROLE_PERMISSIONS[role] || [];
    const allPerms = new Set([...permissions, ...rolePerms]);

    // 依權限過濾出可存取的路由（無 permission 要求者一律可存取）
    const accessibleRoutes = FULL_ROUTES.filter(
      (route) => !route.permission || allPerms.has(route.permission),
    );

    // 依權限過濾選單，並排除標記為 hideFromMenu 的項目（例如改以地圖浮動按鈕呈現）
    const menuTree = FULL_MENU.filter(
      (item) => !item.hideFromMenu && (!item.permission || allPerms.has(item.permission)),
    );

    set({
      permissionCodes: allPerms,
      accessibleRoutes,
      menuTree,
    });
  },

  hasPermission: (code: string) => get().permissionCodes.has(code),

  hasRole: (_role: RoleType) => {
    // 此函式通常應對照 useUserStore 中的角色進行比對
    return false; // 目前為預留介面，尚未串接 useUserStore.user.role
  },

  reset: () => set({ accessibleRoutes: [], menuTree: [], permissionCodes: new Set() }),
}));
