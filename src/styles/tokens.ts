export const designTokens = {
  colors: {
    primary: '#1B5E9C',
    success: '#52C41A',
    warning: '#FAAD14',
    danger: '#F5222D',
    info: '#909399',
    textPrimary: '#303133',
    textSecondary: '#606266',
    textPlaceholder: '#C0C4CC',
    border: '#DCDFE6',
    background: '#F5F7FA',
    white: '#FFFFFF',
  },
  typography: {
    fontFamily: "'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC', sans-serif",
    fontSize: {
      pageTitle: '20px',
      sectionTitle: '18px',
      body: '14px',
      helper: '12px',
    },
  },
  spacing: {
    base: 4,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  borderRadius: {
    small: '4px',
    medium: '8px',
  },
} as const;
