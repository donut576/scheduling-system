/**
 * 設計 Token（Design Tokens）定義檔。
 * 集中管理全站共用的顏色、字型、間距與圓角等視覺設計基本單位，
 * 供 antd-theme.ts 及其他樣式檔案引用，確保視覺風格一致。
 */
export const designTokens = {
  // 全站配色（主色、成功/警告/危險/資訊色、文字顏色、邊框、背景等）
  colors: {
    primary: '#005EB8',
    success: '#3BAF52',
    warning: '#F2A900',
    danger: '#D71920',
    info: '#0072CE',
    textPrimary: '#1F2933',
    textSecondary: '#52606D',
    textPlaceholder: '#C0C4CC',
    border: '#D7E2EA',
    background: '#F4F8FB',
    white: '#FFFFFF',
  },
  // 字型設定（含中文字型後援清單）與各層級文字大小
  typography: {
    fontFamily: "'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC', sans-serif",
    fontSize: {
      pageTitle: '20px',
      sectionTitle: '18px',
      body: '14px',
      helper: '12px',
    },
  },
  // 間距單位（以 4px 為基準的倍數，供版面留白使用）
  spacing: {
    base: 4,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  // 元件圓角大小
  borderRadius: {
    small: '4px',
    medium: '8px',
  },
} as const;
