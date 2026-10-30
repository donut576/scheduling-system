/**
 * 彈性任務卡片配色工具模組。
 *
 * 由班表事件原色推導彈性任務（timeMode: FLEXIBLE）卡片的淡色斜紋底、
 * 虛線框、標籤底色與深色文字。
 */
import { hexToRgb } from './colorContrast';

export interface FlexibleCardTheme {
  border: string;
  backgroundColor: string;
  backgroundImage: string;
  color: string;
  badgeBg: string;
}

/** 與白(255)或黑(0)混色；ratio 為原色所佔比例 */
const mix = (c: { r: number; g: number; b: number }, target: number, ratio: number): string => {
  const f = (v: number) => Math.round(v * ratio + target * (1 - ratio));
  return `rgb(${f(c.r)}, ${f(c.g)}, ${f(c.b)})`;
};

/** 彈性任務卡片樣式：由事件原色推導淡色斜紋底、虛線框、標籤色、深色文字 */
export const getFlexibleCardTheme = (eventColor: string): FlexibleCardTheme => {
  try {
    const rgb = hexToRgb(eventColor);
    const light = mix(rgb, 255, 0.12);
    const lighter = mix(rgb, 255, 0.22);
    return {
      border: eventColor,
      backgroundColor: light,
      backgroundImage: `repeating-linear-gradient(135deg, ${light} 0, ${light} 9px, ${lighter} 9px, ${lighter} 18px)`,
      color: mix(rgb, 0, 0.65),
      badgeBg: eventColor,
    };
  } catch {
    // 非 hex 色碼時退回中性灰，避免文字與底色同色
    return {
      border: '#8c8c8c',
      backgroundColor: '#f5f5f5',
      backgroundImage:
        'repeating-linear-gradient(135deg, #f5f5f5 0, #f5f5f5 9px, #ebebeb 9px, #ebebeb 18px)',
      color: '#595959',
      badgeBg: '#8c8c8c',
    };
  }
};
