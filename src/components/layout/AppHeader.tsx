/**
 * AppHeader - 頂部導覽列元件
 *
 * 顯示漢堡選單按鈕（開啟 Sidebar Drawer）、品牌名稱、語言切換下拉選單，
 * 以及使用者資訊下拉選單（含員工編號、職位、登出按鈕）。
 */
import React from 'react';
import { Layout, Button, Dropdown, Space, Typography } from 'antd';
import { DownOutlined, LogoutOutlined, MenuOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/useAppStore';
import { useUserStore } from '@/stores/useUserStore';

const { Header } = Layout;
const { Text } = Typography;

const ROLE_LABEL_MAP: Record<string, string> = {
  ADMIN: '系統管理員',
  ADMIN_STAFF: '行政人員',
  MANAGER: '經理',
  LEADER: '組長',
  STAFF: '服務專員 (一般員工)',
};

// 頂部導覽列：包含側邊選單開關、品牌 Logo 與使用者選單
const AppHeader: React.FC = () => {
  const { t } = useTranslation();
  const { toggleSidebar } = useAppStore();
  const { user, logout } = useUserStore();

  const roleDisplay = user?.role ? (ROLE_LABEL_MAP[user.role] ?? user.role) : '-';

  return (
    <Header
      style={{
        padding: '0 20px',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: '1px solid #f0f0f0',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <Button
        type="text"
        icon={<MenuOutlined />}
        onClick={toggleSidebar}
        aria-label="Open sidebar"
      />
      <Text strong style={{ color: '#005EB8', fontSize: 18, letterSpacing: 0 }}>
        Ecolab
      </Text>
      <Space size={8} style={{ marginLeft: 'auto' }}>
        {/* 使用者資訊下拉選單：顯示姓名/員工編號/職位（不可點選），並提供登出按鈕 */}
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'profile',
                disabled: true,
                label: (
                  <Space direction="vertical" size={2} style={{ minWidth: 180 }}>
                    <Text strong>{user?.name ?? '-'}</Text>
                    <Text type="secondary">{`${t('employee.employeeNo')}：${user?.employeeNo ?? '-'}`}</Text>
                    <Text type="secondary">{`${t('employee.position')}：${roleDisplay}`}</Text>
                  </Space>
                ),
              },
              { type: 'divider' },
              {
                key: 'logout',
                danger: true,
                icon: <LogoutOutlined />,
                label: t('auth.logout'),
                onClick: logout,
              },
            ],
          }}
        >
          <Button icon={<UserOutlined />}>
            <Space size={4}>
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.name ?? ''}
              </span>
              <DownOutlined />
            </Space>
          </Button>
        </Dropdown>
      </Space>
    </Header>
  );
};

export default AppHeader;
