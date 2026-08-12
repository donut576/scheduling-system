import React, { useEffect, useRef } from 'react';
import { Layout, Drawer, Tabs } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { TabsProps } from 'antd';
import { useAppStore } from '@/stores/useAppStore';
import { usePermissionStore, FULL_MENU } from '@/stores/usePermissionStore';
import { useIsMobile } from '@/hooks/useMediaQuery';
import SideMenu from './SideMenu';
import AppHeader from './AppHeader';

const { Sider, Content } = Layout;

/**
 * 根據路徑解析選單/路由標籤文字，優先使用目前權限選單樹（menuTree）中的標籤，
 * 若找不到（例如使用者權限尚未載入完成）則回退至完整選單設定（FULL_MENU），
 * 最終皆找不到時以路徑本身作為標籤文字。
 */
function resolveTabLabel(pathname: string, menuTree: { key: string; label: string }[]): string {
  const fromMenuTree = menuTree.find((item) => item.key === pathname);
  if (fromMenuTree) return fromMenuTree.label;

  const fromFullMenu = FULL_MENU.find((item) => item.key === pathname);
  if (fromFullMenu) return fromFullMenu.label;

  return pathname;
}

/**
 * MainLayout - 主版面配置
 *
 * 響應式：< 768px 時 Sidebar 摺疊為 Drawer（使用共用 useIsMobile hook 判斷斷點）
 *
 * Validates: Requirements 16.2（此處為 Sidebar/Drawer 切換部分）
 */
const MainLayout: React.FC = () => {
  const { sidebarCollapsed, setSidebarCollapsed, tabs, addTab, removeTab } = useAppStore();
  const { menuTree } = usePermissionStore();
  const isMobile = useIsMobile();
  const wasMobileRef = useRef(isMobile);
  const location = useLocation();
  const navigate = useNavigate();

  // 進入行動裝置寬度時，預設收起 Drawer（避免版面切換時 Sidebar 意外展開覆蓋畫面）
  useEffect(() => {
    if (isMobile && !wasMobileRef.current && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
    wasMobileRef.current = isMobile;
  }, [isMobile, sidebarCollapsed, setSidebarCollapsed]);

  // 路由變更時，將目前頁面加入分頁標籤列（若尚未存在）
  useEffect(() => {
    const pathname = location.pathname;
    addTab({
      key: pathname,
      label: resolveTabLabel(pathname, menuTree),
      closable: pathname !== '/dashboard',
    });
    // menuTree 於初次載入後才會填入，故不將其列為依賴避免重複觸發；
    // 僅需在路徑變更時執行一次加入分頁邏輯。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, addTab]);

  const handleDrawerClose = () => {
    setSidebarCollapsed(true);
  };

  const handleTabChange = (activeKey: string) => {
    navigate(activeKey);
  };

  const handleTabEdit: TabsProps['onEdit'] = (targetKey, action) => {
    if (action !== 'remove') return;
    const key = targetKey as string;
    const isActive = key === location.pathname;
    removeTab(key);

    if (isActive) {
      const remaining = tabs.filter((tab) => tab.key !== key);
      const fallback = remaining[remaining.length - 1]?.key ?? '/dashboard';
      navigate(fallback);
    }
  };

  const tabItems: TabsProps['items'] = tabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    closable: tab.closable,
  }));

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {isMobile ? (
        <Drawer
          placement="left"
          open={!sidebarCollapsed}
          onClose={handleDrawerClose}
          styles={{ body: { padding: 0 } }}
          width={220}
        >
          <div
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: 16,
              borderBottom: '1px solid #f0f0f0',
            }}
          >
            EcoLab
          </div>
          <SideMenu />
        </Drawer>
      ) : (
        <Sider
          trigger={null}
          collapsible
          collapsed={sidebarCollapsed}
          width={220}
          theme="light"
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'sticky',
            top: 0,
            left: 0,
            borderRight: '1px solid #f0f0f0',
          }}
        >
          <div
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: sidebarCollapsed ? 14 : 16,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            {sidebarCollapsed ? 'EL' : 'EcoLab'}
          </div>
          <SideMenu />
        </Sider>
      )}

      <Layout>
        <AppHeader />
        <div data-testid="page-tabs">
          <Tabs
            type="editable-card"
            hideAdd
            activeKey={location.pathname}
            items={tabItems}
            onChange={handleTabChange}
            onEdit={handleTabEdit}
            style={{ margin: '8px 16px 0' }}
          />
        </div>
        <Content
          style={{
            margin: 16,
            padding: 24,
            background: '#fff',
            borderRadius: 8,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
