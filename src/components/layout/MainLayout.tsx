import React, { useEffect, useRef } from 'react';
import { Layout, Drawer } from 'antd';
import { Outlet } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import { useIsMobile } from '@/hooks/useMediaQuery';
import SideMenu from './SideMenu';
import AppHeader from './AppHeader';
import MapFloatingButton from './MapFloatingButton';

const { Sider, Content } = Layout;

/**
 * MainLayout - 主版面配置
 *
 * 固定左側可收合 Sidebar 作為唯一導覽方式，點選選單項目直接切換頁面（無多分頁標籤列）。
 * 響應式：< 768px 時 Sidebar 摺疊為 Drawer（使用共用 useIsMobile hook 判斷斷點）
 *
 * Validates: Requirements 16.2（此處為 Sidebar/Drawer 切換部分）
 */
const MainLayout: React.FC = () => {
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const isMobile = useIsMobile();
  const wasMobileRef = useRef(isMobile);

  // 進入行動裝置寬度時，預設收起 Drawer（避免版面切換時 Sidebar 意外展開覆蓋畫面）
  useEffect(() => {
    if (isMobile && !wasMobileRef.current && !sidebarCollapsed) {
      setSidebarCollapsed(true);
    }
    wasMobileRef.current = isMobile;
  }, [isMobile, sidebarCollapsed, setSidebarCollapsed]);

  const handleDrawerClose = () => {
    setSidebarCollapsed(true);
  };

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
          collapsedWidth={0}
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

      <MapFloatingButton />
    </Layout>
  );
};

export default MainLayout;
