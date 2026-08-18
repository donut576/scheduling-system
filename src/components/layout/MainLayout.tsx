import React, { useEffect } from 'react';
import { Drawer, Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import { useAppStore } from '@/stores/useAppStore';
import SideMenu from './SideMenu';
import AppHeader from './AppHeader';
import MapFloatingButton from './MapFloatingButton';

const { Content } = Layout;

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

  // 元件掛載時預設收合側邊選單，避免進入頁面時 Drawer 自動展開
  useEffect(() => {
    setSidebarCollapsed(true);
  }, [setSidebarCollapsed]);

  // 關閉側邊選單 Drawer（點選選單項目或點擊遮罩時觸發）
  const handleDrawerClose = () => {
    setSidebarCollapsed(true);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 側邊選單以 Drawer 形式呈現，透過 sidebarCollapsed 狀態控制開關 */}
      <Drawer
        placement="left"
        open={!sidebarCollapsed}
        onClose={handleDrawerClose}
        styles={{ body: { padding: 0 } }}
        width={260}
      >
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            fontWeight: 700,
            fontSize: 18,
            color: '#005EB8',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          Ecolab
        </div>
        <SideMenu onNavigate={handleDrawerClose} />
      </Drawer>

      <Layout>
        <AppHeader />
        {/* Content 區域渲染實際匹配的子路由頁面內容，Header/Sidebar 保持不變 */}
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

      {/* 全域地圖浮動按鈕（右下角） */}
      <MapFloatingButton />
    </Layout>
  );
};

export default MainLayout;
