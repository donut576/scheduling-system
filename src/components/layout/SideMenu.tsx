import React from 'react';
import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissionStore } from '@/stores/usePermissionStore';
import type { MenuItem } from '@/types/common';
import type { MenuProps } from 'antd';

type AntMenuItem = Required<MenuProps>['items'][number];

function mapMenuItems(items: MenuItem[]): AntMenuItem[] {
  return items.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    children: item.children ? mapMenuItems(item.children) : undefined,
  }));
}

const SideMenu: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { menuTree } = usePermissionStore();

  const items = mapMenuItems(menuTree);

  const handleClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
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
