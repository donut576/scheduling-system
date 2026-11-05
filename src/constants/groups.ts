import type { SelectOption } from '@/types/common';
import { isRealApi } from '@/utils/dataSource';

/**
 * 地區下拉選單常數（用於員工管理頁面與相關篩選）
 * 欲修改或擴充地區列表，請在此處編輯
 */
const LEGACY_AREA_OPTIONS: SelectOption[] = [
  { label: '台北', value: '台北' },
  { label: '新竹', value: '新竹' },
  { label: '台南', value: '台南' },
  { label: '台中', value: '台中' },
];

/** PE 新規則的 12 個群組（名稱需與後端 regions 資料表一致） */
export const REGION_GROUP_OPTIONS: SelectOption[] = [
  '北早',
  '北一晚',
  '北二晚',
  '桃一早',
  '桃二早',
  '桃竹晚',
  '中區早',
  '中區晚',
  '嘉義早',
  '嘉義晚',
  '南區早',
  '南區晚',
].map((name) => ({ label: name, value: name }));

/** 接真後端（VITE_USE_MOCK_API=false）用 12 個群組；模擬資料模式維持舊的四個地區 */
export const AREA_OPTIONS: SelectOption[] = isRealApi ? REGION_GROUP_OPTIONS : LEGACY_AREA_OPTIONS;

/**
 * 班別下拉選單常數（用於員工管理頁面與相關篩選）
 * 欲修改或擴充班別列表，請在此處編輯
 */
export const EMPLOYEE_SHIFT_OPTIONS: SelectOption[] = [
  { label: '早班', value: '早班' },
  { label: '午班', value: '午班' },
  { label: '大夜班', value: '大夜班' },
];

export interface EmployeeGroupOption extends SelectOption {
  area: string;
  shift: string;
}

/** 預設員工組別選項組合 */
export const EMPLOYEE_GROUP_OPTIONS: EmployeeGroupOption[] = AREA_OPTIONS.flatMap((a) =>
  EMPLOYEE_SHIFT_OPTIONS.map((s) => ({
    label: `${a.label} ${s.label}`,
    value: `${a.value}-${s.value}`,
    area: String(a.value),
    shift: String(s.value),
  })),
);
