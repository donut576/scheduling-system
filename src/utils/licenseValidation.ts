/**
 * 證照衝突驗證工具模組。
 *
 * 依據 constants/licenseTypes.ts 定義之衝突規則，檢查員工選擇的
 * 證照組合是否存在互斥（衝突）情況。
 */
import type { LicenseType } from '@/types/alert';
import { LICENSE_CONFLICT_RULES } from '@/constants/licenseTypes';

/**
 * 純函式：檢查證照組合是否存在衝突
 *
 * 規則來源：constants/licenseTypes.ts 之 LICENSE_CONFLICT_RULES
 * 目前規則：選擇「無」（NONE）時不可同時選擇任何其他證照類型
 *
 * Validates: Requirements 11.6
 */
export function hasLicenseConflict(licenses: LicenseType[]): boolean {
  const ruleKeys = Object.keys(LICENSE_CONFLICT_RULES) as Array<
    keyof typeof LICENSE_CONFLICT_RULES
  >;

  return ruleKeys.some((key) => {
    if (!licenses.includes(key as LicenseType)) return false;
    const conflictingLicenses = LICENSE_CONFLICT_RULES[key] as readonly LicenseType[];
    return conflictingLicenses.some((conflict) => licenses.includes(conflict));
  });
}

/**
 * 純函式：檢查員工是否「僅持有施藥證」（PEST_CONTROL 為唯一一張證照）。
 *
 * 用於員工編輯流程中提醒管理者：此員工缺乏其他安全衛生相關證照，
 * 於指派需多重證照要求之任務前應留意其資格是否足夠。
 */
export function hasOnlyPestControlLicense(licenses: LicenseType[]): boolean {
  return licenses.length === 1 && licenses[0] === 'PEST_CONTROL';
}
