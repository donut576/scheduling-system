import React from 'react';
import { FloatButton } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePermissionStore } from '@/stores/usePermissionStore';

/**
 * 地圖檢視全域浮動按鈕
 *
 * 地圖檢視改以固定於畫面右下角的浮動按鈕呈現，取代原側邊選單項目，
 * 任何頁面皆可快速開啟地圖（權限判斷與 /map 路由本身一致，仍需 map:view）。
 */
const MapFloatingButton: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasMapPermission = usePermissionStore((state) => state.hasPermission('map:view'));

  if (!hasMapPermission || location.pathname === '/map') {
    return null;
  }

  return (
    <FloatButton
      icon={<EnvironmentOutlined />}
      tooltip="地圖檢視"
      aria-label="地圖檢視"
      onClick={() => navigate('/map')}
    />
  );
};

export default MapFloatingButton;
