/**
 * SideMenu - 側邊導覽選單元件
 *
 * 根據權限系統產生的選單樹（menuTree）渲染巢狀選單項目，
 * 並依目前路徑（location.pathname）標示選中狀態，點選項目時導航至對應路由。
 */
import React from 'react';
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { useUserStore } from '@/stores/useUserStore';
import type { MenuItem } from '@/types/common';
import type { MenuProps } from 'antd';

type AntMenuItem = Required<MenuProps>['items'][number];

// 選單項目 key 對應到 i18n 翻譯字串的鍵值，用於顯示多語系選單文字
const MENU_TRANSLATION_KEYS: Record<string, string> = {
  '/dashboard': 'menu.dashboard',
  '/task': 'menu.task',
  '/schedule': 'menu.schedule',
  '/customer': 'menu.customer',
  '/employee': 'menu.employee',
  '/notification': 'menu.notification',
  '/approval': 'menu.approval',
  '/pending-customer': 'menu.pendingCustomer',
  '/map': 'menu.map',
};

// 將權限系統產生的 MenuItem 結構（遞迴）轉換為 Ant Design Menu 所需的 items 格式
function mapMenuItems(items: MenuItem[]): AntMenuItem[] {
  return items.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    children: item.children ? mapMenuItems(item.children) : undefined,
  }));
}

interface SideMenuProps {
  /** 點選選單項目導航後的回呼（例如關閉 Drawer） */
  onNavigate?: () => void;
}

/** 側邊選單主元件：依權限產生的選單樹渲染巢狀導覽選單 */
const SideMenu: React.FC<SideMenuProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { menuTree } = usePermissionStore();
  const user = useUserStore((state) => state.user);
  const isStaff = user?.role === 'STAFF';

  // 先將選單樹的 label 依 i18n 翻譯（找不到對應 key 時 fallback 為原始 label）
  const translatedMenuTree = menuTree.map((item) => {
    let labelKey = MENU_TRANSLATION_KEYS[item.key] ?? item.key;
    if (isStaff) {
      if (item.key === '/customer') labelKey = 'menu.customerStaff';
      if (item.key === '/employee') labelKey = 'menu.employeeStaff';
      if (item.key === '/notification') labelKey = 'menu.notificationStaff';
    }
    return {
      ...item,
      label: t(labelKey, item.label),
    };
  });
  const items = mapMenuItems(translatedMenuTree);

  // 點選選單項目時導航至對應路由，並通知外部（例如關閉 Drawer）
  const handleClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
    onNavigate?.();
  };

  return (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={items}
      onClick={handleClick}
      style={{ borderRight: 0 }}
    />
  );
};

export default SideMenu;
