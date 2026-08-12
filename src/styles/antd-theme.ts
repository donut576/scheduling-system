/**
 * Ant Design 主題設定檔。
 * 將專案自訂的設計 token（designTokens）套用到 Ant Design 的 ConfigProvider 主題，
 * 統一全站配色、字型與各元件（Button、Table、Layout、Menu、Card）的樣式。
 */
import type { ThemeConfig } from 'antd';
import { designTokens } from './tokens';

// 提供給 <ConfigProvider theme={antdTheme}> 使用的主題設定
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: designTokens.colors.primary,
    colorSuccess: designTokens.colors.success,
    colorWarning: designTokens.colors.warning,
    colorError: designTokens.colors.danger,
    colorInfo: designTokens.colors.info,
    colorTextBase: designTokens.colors.textPrimary,
    colorBorder: designTokens.colors.border,
    colorBgLayout: designTokens.colors.background,
    fontFamily: designTokens.typography.fontFamily,
    fontSize: 14,
    borderRadius: 6,
  },
  components: {
    Button: {
      primaryShadow: 'none',
    },
    Table: {
      headerBg: '#EAF3FA',
      headerColor: '#1F2933',
    },
    Layout: {
      siderBg: '#FFFFFF',
      headerBg: designTokens.colors.white,
    },
    Menu: {
      itemSelectedBg: '#E6F2FB',
      itemSelectedColor: designTokens.colors.primary,
      itemHoverColor: designTokens.colors.primary,
    },
    Card: {
      headerBg: '#FFFFFF',
    },
  },
};
