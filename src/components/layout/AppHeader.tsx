import React from 'react';
import { Layout, Button, Dropdown, Space, Badge, Typography, Popover } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  GlobalOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '@/stores/useUserStore';
import { useAppStore } from '@/stores/useAppStore';
import NotificationCenter, {
  useUnreadNotificationCount,
} from '@/components/business/NotificationCenter';
import type { MenuProps } from 'antd';

const { Header } = Layout;
const { Text } = Typography;

const AppHeader: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, logout } = useUserStore();
  const { sidebarCollapsed, toggleSidebar, locale, setLocale } = useAppStore();
  const unreadCount = useUnreadNotificationCount();

  const handleLocaleChange = (newLocale: 'zh-TW' | 'en-US') => {
    setLocale(newLocale);
    i18n.changeLanguage(newLocale);
  };

  const localeMenuItems: MenuProps['items'] = [
    {
      key: 'zh-TW',
      label: '繁體中文',
      onClick: () => handleLocaleChange('zh-TW'),
    },
    {
      key: 'en-US',
      label: 'English',
      onClick: () => handleLocaleChange('en-US'),
    },
  ];

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('auth.logout'),
      onClick: logout,
    },
  ];

  return (
    <Header
      style={{
        padding: '0 24px',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <Button
        type="text"
        icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      />

      <Space size="middle">
        <Popover
          content={<NotificationCenter />}
          trigger="click"
          placement="bottomRight"
          arrow={false}
        >
          <Badge count={unreadCount} size="small">
            <Button type="text" icon={<BellOutlined />} aria-label={t('notification.center')} />
          </Badge>
        </Popover>

        <Dropdown menu={{ items: localeMenuItems, selectedKeys: [locale] }}>
          <Button type="text" icon={<GlobalOutlined />}>
            {locale === 'zh-TW' ? '中文' : 'EN'}
          </Button>
        </Dropdown>

        <Dropdown menu={{ items: userMenuItems }}>
          {/* Space 本身不具鍵盤可聚焦性，加上 role/tabIndex/onKeyDown 使其可透過
              Tab 鍵聚焦並以 Enter/Space 觸發下拉選單，滿足鍵盤導航需求 */}
          <Space
            style={{ cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            aria-label={`使用者選單：${user?.name ?? ''}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.currentTarget.click();
              }
            }}
          >
            <UserOutlined />
            <Text>{user?.name ?? ''}</Text>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
};

export default AppHeader;
