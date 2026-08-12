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
