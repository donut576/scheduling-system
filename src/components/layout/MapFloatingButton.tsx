import React from 'react';
import { FloatButton } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissionStore } from '@/stores/usePermissionStore';

/**
 * 地圖檢視全域浮動按鈕
 *
 * 固定於畫面右下角的浮動按鈕，任何頁面皆可快速開啟地圖（權限需 map:view）。
 */
const MapFloatingButton: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const hasMapPermission = usePermissionStore((state) => state.hasPermission('map:view'));

  if (!hasMapPermission || location.pathname === '/map') {
    return null;
  }

  return (
    <FloatButton
      type="primary"
      icon={<EnvironmentOutlined />}
      tooltip={t('menu.map')}
      aria-label={t('menu.map')}
      onClick={() => navigate('/map')}
      style={{ width: 50, height: 50, right: 24, bottom: 24 }}
    />
  );
};

export default MapFloatingButton;
