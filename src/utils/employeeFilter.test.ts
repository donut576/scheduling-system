/**
 * 測試對象：src/utils/employeeFilter.ts
 * 涵蓋員工多條件篩選函式 filterEmployees，包含 property-based tests
 * （fast-check）驗證群組、證照、休假等多重篩選條件之 AND 邏輯正確性。
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterEmployees, type EmployeeFilterCriteria } from './employeeFilter';
import type { Employee } from '@/types/employee';
import type { LicenseType } from '@/types/alert';

/**
 * **Validates: Requirements 3.6**
 *
 * Property 8: 員工多條件篩選
 * 驗證：for any 篩選組合，結果僅包含同時滿足所有條件之員工
 */

const LICENSE_TYPES: LicenseType[] = [
  'NONE',
  'PROFESSIONAL',
  'PEST_CONTROL',
  'FIRE_ANT',
  'SAFETY_6HR',
  'SAFETY_MANAGER_A',
  'SAFETY_MANAGER_B',
  'SAFETY_MANAGER_C',
];

const POSITION_TYPES = ['STAFF', 'LEADER', 'MANAGER', 'ADMIN_STAFF'] as const;

// Generator for a valid date string in YYYY-MM-DD format
const arbDateStr = fc
  .tuple(
    fc.integer({ min: 2024, max: 2026 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

// Generator for a group ID (small set to ensure overlaps)
const arbGroupId = fc
  .stringOf(fc.constantFrom('a', 'b', 'c', 'd'), { minLength: 1, maxLength: 3 })
  .map((s) => `group-${s}`);

// Generator for a single Employee
const arbEmployee: fc.Arbitrary<Employee> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 10 }),
  phone: fc.string({ minLength: 10, maxLength: 10 }),
  employeeNo: fc.string({ minLength: 3, maxLength: 6 }),
  position: fc.constantFrom(...POSITION_TYPES),
  groupId: arbGroupId,
  groupName: fc.string({ minLength: 1, maxLength: 5 }),
  area: fc.constantFrom('台北', '新竹', '台南', '台中'),
  shift: fc.constantFrom('早班', '午班', '晚班', '大夜班'),
  groupColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map((s) => `#${s}`),
  designatedLeaves: fc.array(arbDateStr, { minLength: 0, maxLength: 5 }),
  licenses: fc.subarray(LICENSE_TYPES, { minLength: 1, maxLength: 4 }),
  isActive: fc.boolean(),
});

// Generator for filter criteria that uses values from the generated employees
const arbFilterCriteria = (employees: Employee[]): fc.Arbitrary<EmployeeFilterCriteria> => {
  // Extract possible group IDs from employees (or use arbitrary)
  const groupIds = [...new Set(employees.map((e) => e.groupId))];
  const arbGroupFilter =
    groupIds.length > 0
      ? fc.option(fc.constantFrom(...groupIds), { nil: undefined })
      : fc.constant(undefined);

  const arbLicenseFilter = fc.option(fc.constantFrom(...LICENSE_TYPES), { nil: undefined });
  const arbHideOnLeave = fc.option(fc.constant(true), { nil: undefined });
  const arbDate = fc.option(arbDateStr, { nil: undefined });

  return fc.record({
    groupId: arbGroupFilter,
    licenseType: arbLicenseFilter,
    hideOnLeave: arbHideOnLeave,
    date: arbDate,
  });
};

describe('Property 8: 員工多條件篩選', () => {
  it('篩選結果中每位員工皆滿足所有啟用之篩選條件', () => {
    fc.assert(
      fc.property(
        fc
          .array(arbEmployee, { minLength: 0, maxLength: 20 })
          .chain((employees) => fc.tuple(fc.constant(employees), arbFilterCriteria(employees))),
        ([employees, criteria]) => {
          const result = filterEmployees(employees, criteria);

          // Every employee in result must satisfy ALL active conditions
          for (const emp of result) {
            if (criteria.groupId) {
              expect(emp.groupId).toBe(criteria.groupId);
            }
            if (criteria.licenseType) {
              expect(emp.licenses).toContain(criteria.licenseType);
            }
            if (criteria.hideOnLeave && criteria.date) {
              expect(emp.designatedLeaves).not.toContain(criteria.date);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('滿足所有篩選條件之員工不會被排除於結果之外', () => {
    fc.assert(
      fc.property(
        fc
          .array(arbEmployee, { minLength: 0, maxLength: 20 })
          .chain((employees) => fc.tuple(fc.constant(employees), arbFilterCriteria(employees))),
        ([employees, criteria]) => {
          const result = filterEmployees(employees, criteria);
          const resultIds = new Set(result.map((e) => e.id));

          // Every employee who satisfies all conditions must be in the result
          for (const emp of employees) {
            const matchesGroup = !criteria.groupId || emp.groupId === criteria.groupId;
            const matchesLicense =
              !criteria.licenseType || emp.licenses.includes(criteria.licenseType);
            const matchesLeave =
              !(criteria.hideOnLeave && criteria.date) ||
              !emp.designatedLeaves.includes(criteria.date);

            if (matchesGroup && matchesLicense && matchesLeave) {
              expect(resultIds.has(emp.id)).toBe(true);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('結果為原始列表之子集', () => {
    fc.assert(
      fc.property(
        fc
          .array(arbEmployee, { minLength: 0, maxLength: 20 })
          .chain((employees) => fc.tuple(fc.constant(employees), arbFilterCriteria(employees))),
        ([employees, criteria]) => {
          const result = filterEmployees(employees, criteria);
          const originalIds = new Set(employees.map((e) => e.id));

          // Every result employee must exist in the original list
          for (const emp of result) {
            expect(originalIds.has(emp.id)).toBe(true);
          }

          // Result size cannot exceed original size
          expect(result.length).toBeLessThanOrEqual(employees.length);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('無篩選條件時回傳所有員工', () => {
    fc.assert(
      fc.property(fc.array(arbEmployee, { minLength: 0, maxLength: 20 }), (employees) => {
        const result = filterEmployees(employees, {});
        expect(result.length).toBe(employees.length);
      }),
      { numRuns: 100 },
    );
  });
});
