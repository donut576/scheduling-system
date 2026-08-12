import React from 'react';
import { FloatButton } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissionStore } from '@/stores/usePermissionStore';

/**
 * 地圖檢視全域浮動按鈕
 *
 * 地圖檢視改以固定於畫面右下角的浮動按鈕呈現，取代原側邊選單項目，
 * 任何頁面皆可快速開啟地圖（權限判斷與 /map 路由本身一致，仍需 map:view）。
 */
const MapFloatingButton: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  // 需具備 map:view 權限才能顯示浮動按鈕
  const hasMapPermission = usePermissionStore((state) => state.hasPermission('map:view'));

  // 無權限，或目前已在地圖頁面時，不顯示浮動按鈕（避免在地圖頁面上重複顯示入口）
  if (!hasMapPermission || location.pathname === '/map') {
    return null;
  }

  return (
    <FloatButton
      icon={<EnvironmentOutlined />}
      tooltip={t('menu.map')}
      aria-label={t('menu.map')}
      onClick={() => navigate('/map')}
    />
  );
};

export default MapFloatingButton;
