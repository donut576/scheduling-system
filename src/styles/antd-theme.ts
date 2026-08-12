import type { ThemeConfig } from 'antd';
import { designTokens } from './tokens';

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
    borderRadius: 4,
  },
  components: {
    Button: {
      primaryShadow: 'none',
    },
    Table: {
      headerBg: designTokens.colors.background,
    },
    Layout: {
      siderBg: designTokens.colors.white,
      headerBg: designTokens.colors.white,
    },
  },
};
