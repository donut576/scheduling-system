import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Customer } from '@/types/customer';
import { filterCustomersByLocation } from './mapFilter';

/**
 * **Validates: Requirements 15.3**
 *
 * Property 27: 地圖篩選正確性
 * 驗證：for any 篩選條件組合，地圖標記僅包含符合所有條件之分店
 */

// Small, bounded pools of ids so generated filter values have a realistic
// chance of matching some generated customers (avoids trivially-empty results).
const groupIdPool = ['group-1', 'group-2', 'group-3'];
const branchIdPool = ['branch-1', 'branch-2', 'branch-3', 'branch-4'];

const arbCustomer: fc.Arbitrary<Customer> = fc.record({
  id: fc.uuid(),
  groupId: fc.constantFrom(...groupIdPool),
  groupName: fc.string({ minLength: 1, maxLength: 10 }),
  branchId: fc.constantFrom(...branchIdPool),
  branchName: fc.string({ minLength: 1, maxLength: 10 }),
  address: fc.string({ minLength: 1, maxLength: 20 }),
  latitude: fc.option(fc.float({ min: -90, max: 90, noNaN: true }), { nil: undefined }),
  longitude: fc.option(fc.float({ min: -180, max: 180, noNaN: true }), { nil: undefined }),
  contactName: fc.string({ minLength: 1, maxLength: 10 }),
  contactPhone: fc.string({ minLength: 1, maxLength: 10 }),
  requiredLicenses: fc.constant([]),
});

const arbCustomers = fc.array(arbCustomer, { maxLength: 15 });

// Filter values may be undefined (unconstrained) or drawn from the same pool
// used for customers, so both matching and non-matching filters are exercised.
const arbGroupIdFilter = fc.option(fc.constantFrom(...groupIdPool), { nil: undefined });
const arbBranchIdFilter = fc.option(fc.constantFrom(...branchIdPool), { nil: undefined });

describe('Property 27: 地圖篩選正確性', () => {
  it('結果中每筆客戶皆符合所有已設定（非 undefined）之篩選條件（無過度篩選遺漏）', () => {
    fc.assert(
      fc.property(
        arbCustomers,
        arbGroupIdFilter,
        arbBranchIdFilter,
        (customers, groupId, branchId) => {
          const result = filterCustomersByLocation(customers, { groupId, branchId });

          for (const c of result) {
            if (groupId !== undefined) {
              expect(c.groupId).toBe(groupId);
            }
            if (branchId !== undefined) {
              expect(c.branchId).toBe(branchId);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('結果完整包含所有符合條件之客戶（無漏篩），且不包含任何不符合條件之客戶', () => {
    fc.assert(
      fc.property(
        arbCustomers,
        arbGroupIdFilter,
        arbBranchIdFilter,
        (customers, groupId, branchId) => {
          const result = filterCustomersByLocation(customers, { groupId, branchId });

          const expectedMatches = customers.filter((c) => {
            if (groupId !== undefined && c.groupId !== groupId) return false;
            if (branchId !== undefined && c.branchId !== branchId) return false;
            return true;
          });

          // Exact-set equality by id (order-independent).
          expect(new Set(result.map((c) => c.id))).toEqual(
            new Set(expectedMatches.map((c) => c.id)),
          );
          expect(result.length).toBe(expectedMatches.length);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('無任何篩選條件時，回傳全部客戶', () => {
    fc.assert(
      fc.property(arbCustomers, (customers) => {
        const result = filterCustomersByLocation(customers, {});
        expect(result.length).toBe(customers.length);
      }),
      { numRuns: 100 },
    );
  });
});
