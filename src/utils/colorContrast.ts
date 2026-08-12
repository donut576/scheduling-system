/**
 * 色彩對比度工具模組。
 *
 * 實作 WCAG 2.1 對比度比值計算，用於驗證設計 Token（Design Token）
 * 中色彩組合是否符合無障礙（Accessibility）合規要求。
 */

/**
 * 將 hex 色碼字串解析為 RGB 三個色版數值。
 * 支援 3 位數 (#RGB) 與 6 位數 (#RRGGBB) 兩種格式。
 *
 * @param hex hex 色碼字串（可含或不含 # 前綴）
 * @returns 包含 r、g、b 三個色版數值（0-255）的物件
 * @throws 若 hex 格式不合法則丟出錯誤
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');

  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(cleaned)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  let r: number, g: number, b: number;

  if (cleaned.length === 3) {
    // 上方 regex 已確保恰好為 3 個十六進位字元，因此即使開啟
    // noUncheckedIndexedAccess，此處的索引存取仍是安全的。
    const c0 = cleaned[0] as string;
    const c1 = cleaned[1] as string;
    const c2 = cleaned[2] as string;
    r = parseInt(c0 + c0, 16);
    g = parseInt(c1 + c1, 16);
    b = parseInt(c2 + c2, 16);
  } else {
    r = parseInt(cleaned.substring(0, 2), 16);
    g = parseInt(cleaned.substring(2, 4), 16);
    b = parseInt(cleaned.substring(4, 6), 16);
  }

  return { r, g, b };
}

/**
 * 將 sRGB 色版數值 (0-255) 轉換為相對亮度計算所需的線性化分量。
 * 採用 WCAG 2.1 定義之 sRGB 線性化公式（分段函式）。
 *
 * @param channel 單一色版數值（0-255）
 * @returns 線性化後之數值（0-1）
 */
export function linearize(channel: number): number {
  const sRGB = channel / 255;
  return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
}

/**
 * 計算單一色彩之相對亮度 (Relative Luminance)。
 * 依據 WCAG 2.1 定義：L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * （R、G、B 為線性化後之各色版分量）
 *
 * @param hex hex 色碼字串
 * @returns 相對亮度數值（0-1）
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * 計算兩個色彩之間的對比度比值。
 * 回傳值範圍為 1 至 21。WCAG AA 標準要求一般文字之對比度 ≥ 4.5:1。
 *
 * @param color1 第一個色彩（hex 字串）
 * @param color2 第二個色彩（hex 字串）
 * @returns 對比度比值（1-21，數值越大代表對比越明顯）
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);

  // 取較亮與較暗之亮度值代入公式，確保結果與傳入順序無關（對稱性）
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 檢查前景色/背景色組合是否符合 WCAG AA 對比度要求。
 * 一般文字要求對比度 ≥ 4.5:1；大型文字（如標題）要求 ≥ 3:1。
 *
 * @param foreground 前景色（文字色）
 * @param background 背景色
 * @param isLargeText 是否為大型文字（門檻較寬鬆），預設為 false
 * @returns 是否符合對應之 WCAG AA 對比度門檻
 */
export function meetsWcagAA(foreground: string, background: string, isLargeText = false): boolean {
  const ratio = calculateContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}
