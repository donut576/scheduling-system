import type { SelectOption } from '@/types/common';

/**
 * 24 小時制時間下拉選單選項，每 30 分鐘一個選項（00:00 ~ 23:30）。
 */
export const TIME_OPTIONS: SelectOption[] = Array.from({ length: 48 }, (_, i) => {
  const hour = String(Math.floor(i / 2)).padStart(2, '0');
  const minute = i % 2 === 0 ? '00' : '30';
  const time = `${hour}:${minute}`;
  return { label: time, value: time };
});
