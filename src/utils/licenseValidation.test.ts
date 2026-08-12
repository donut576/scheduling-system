/**
 * 測試對象：src/utils/licenseValidation.ts
 * 涵蓋 hasLicenseConflict 證照衝突檢查函式，包含 property-based tests
 * （fast-check）驗證與 LICENSE_CONFLICT_RULES 規則計算結果一致，
 * 以及 NONE 與其他證照類型混選之衝突判斷邊界情境。
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { LicenseType } from '@/types/alert';
import { LICENSE_TYPE_MAP, LICENSE_CONFLICT_RULES } from '@/constants/licenseTypes';
import { hasLicenseConflict } from './licenseValidation';

/**
 * **Validates: Requirements 11.6**
 *
 * Property 22: 證照衝突驗證
 * 驗證：for any 員工證照組合，若違反衝突規則則回傳錯誤訊息
 */

const ALL_LICENSE_TYPES = Object.keys(LICENSE_TYPE_MAP) as LicenseType[];

// Generator for arbitrary subsets (order-preserving, no duplicates) of LicenseType
const arbLicenseSubset = fc.subarray(ALL_LICENSE_TYPES);

/**
 * Reference (naive) implementation of the conflict rule, derived directly from
 * LICENSE_CONFLICT_RULES: a combination is in conflict iff it contains a key
 * of LICENSE_CONFLICT_RULES together with at least one of its listed conflicts.
 */
function expectedConflict(licenses: LicenseType[]): boolean {
  const ruleKeys = Object.keys(LICENSE_CONFLICT_RULES) as Array<
    keyof typeof LICENSE_CONFLICT_RULES
  >;

  return ruleKeys.some((key) => {
    if (!licenses.includes(key as LicenseType)) return false;
    const conflictingLicenses = LICENSE_CONFLICT_RULES[key] as readonly LicenseType[];
    return conflictingLicenses.some((conflict) => licenses.includes(conflict));
  });
}

describe('Property 22: 證照衝突驗證', () => {
  it('hasLicenseConflict(licenses) 應等於依 LICENSE_CONFLICT_RULES 計算之預期結果', () => {
    fc.assert(
      fc.property(arbLicenseSubset, (licenses) => {
        expect(hasLicenseConflict(licenses)).toBe(expectedConflict(licenses));
      }),
      { numRuns: 200 },
    );
  });

  it('包含 NONE 與至少一個其他證照類型之組合應判定為衝突', () => {
    fc.assert(
      fc.property(
        fc.subarray(
          ALL_LICENSE_TYPES.filter((license) => license !== 'NONE'),
          { minLength: 1 },
        ),
        (otherLicenses) => {
          const licenses: LicenseType[] = ['NONE', ...otherLicenses];
          expect(hasLicenseConflict(licenses)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('不含 NONE 之任意非空證照子集應判定為無衝突', () => {
    fc.assert(
      fc.property(
        fc.subarray(
          ALL_LICENSE_TYPES.filter((license) => license !== 'NONE'),
          { minLength: 1 },
        ),
        (licenses) => {
          expect(hasLicenseConflict(licenses)).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('僅選擇 NONE（單獨一項）應判定為無衝突', () => {
    expect(hasLicenseConflict(['NONE'])).toBe(false);
  });

  it('空陣列（未選擇任何證照）應判定為無衝突', () => {
    expect(hasLicenseConflict([])).toBe(false);
  });
});
