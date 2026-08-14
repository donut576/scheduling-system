import type { SelectOption } from '@/types/common';

/**
 * 地區下拉選單常數（用於員工管理頁面與相關篩選）
 * 欲修改或擴充地區列表，請在此處編輯
 */
export const AREA_OPTIONS: SelectOption[] = [
  { label: '台北', value: '台北' },
  { label: '新竹', value: '新竹' },
  { label: '台南', value: '台南' },
  { label: '台中', value: '台中' },
];

/**
 * 班別下拉選單常數（用於員工管理頁面與相關篩選）
 * 欲修改或擴充班別列表，請在此處編輯
 */
export const EMPLOYEE_SHIFT_OPTIONS: SelectOption[] = [
  { label: '早班', value: '早班' },
  { label: '午班', value: '午班' },
  { label: '晚班', value: '晚班' },
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
