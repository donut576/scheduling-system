/**
 * 證照類型相關常數
 *
 * 提供證照類型對應顯示文字、下拉選單選項，以及證照衝突規則
 * （例如選擇「無」與任何其他證照互斥）。
 */
import type { LicenseType } from '@/types/alert';
import type { SelectOption } from '@/types/common';

/** 證照類型對應顯示文字 */
export const LICENSE_TYPE_MAP: Record<LicenseType, string> = {
  NONE: '無',
  PROFESSIONAL: '專技',
  PEST_CONTROL: '施藥',
  FIRE_ANT: '火蟻防治',
  SAFETY_6HR: '一般安全衛生6小時',
  SAFETY_MANAGER_A: '甲級勞安主管',
  SAFETY_MANAGER_B: '乙級勞安主管',
  SAFETY_MANAGER_C: '丙級勞安主管',
};

/** 證照類型下拉選單選項（由 LICENSE_TYPE_MAP 轉換而來） */
export const LICENSE_TYPE_OPTIONS: SelectOption[] = Object.entries(LICENSE_TYPE_MAP).map(
  ([value, label]) => ({ label, value }),
);

/** 證照衝突規則：選擇「無」時與其他任何證照互斥 */
// License conflict rules: selecting NONE conflicts with any other license
export const LICENSE_CONFLICT_RULES = {
  NONE: [
    'PROFESSIONAL',
    'PEST_CONTROL',
    'FIRE_ANT',
    'SAFETY_6HR',
    'SAFETY_MANAGER_A',
    'SAFETY_MANAGER_B',
    'SAFETY_MANAGER_C',
  ],
} as const;
