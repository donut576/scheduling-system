import React from 'react';
import { FloatButton } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePermissionStore } from '@/stores/usePermissionStore';

/**
 * 地圖檢視全域浮動按鈕
 *
 * 固定於畫面右下角的浮動按鈕，任何頁面皆可快速開啟地圖（權限需 map:view）。
 * 使用使用者指定的專屬折疊地圖與定位圖釘（Teal）Icon。
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
    <>
      <style>{`
        .map-float-btn.ant-float-btn {
          width: 56px !important;
          height: 56px !important;
          right: 24px !important;
          bottom: 24px !important;
          background: #005EB8 !important;
          border-radius: 50% !important;
          box-shadow: 0 4px 16px rgba(0, 94, 184, 0.45) !important;
          border: none !important;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, background 0.2s ease !important;
        }
        .map-float-btn .ant-float-btn-body {
          background: #005EB8 !important;
          border-radius: 50% !important;
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          overflow: visible !important;
        }
        .map-float-btn .ant-float-btn-content {
          width: 100% !important;
          height: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }
        .map-float-btn .ant-float-btn-icon {
          width: 32px !important;
          height: 32px !important;
          font-size: 32px !important;
          line-height: 1 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 !important;
          overflow: visible !important;
        }
        .map-float-btn img {
          width: 30px !important;
          height: 30px !important;
          max-width: 30px !important;
          max-height: 30px !important;
          object-fit: contain !important;
          display: block !important;
          margin: 0 auto !important;
          filter: brightness(0) invert(1) !important;
        }
        .map-float-btn:hover {
          background: #004b94 !important;
          transform: translateY(-3px) scale(1.08) !important;
          box-shadow: 0 8px 24px rgba(0, 94, 184, 0.6) !important;
        }
        .map-float-btn:hover .ant-float-btn-body {
          background: #004b94 !important;
        }
      `}</style>
      <FloatButton
        className="map-float-btn"
        icon={
          <img
            src="/map-icon.png"
            alt={t('menu.map')}
            style={{
              width: 30,
              height: 30,
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto',
            }}
          />
        }
        tooltip={t('menu.map')}
        aria-label={t('menu.map')}
        onClick={() => navigate('/map')}
      />
    </>
  );
};

export default MapFloatingButton;
