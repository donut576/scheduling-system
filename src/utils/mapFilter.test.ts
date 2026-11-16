/**
 * 測試對象：src/utils/mapFilter.ts
 * 涵蓋 filterCustomersByLocation 地圖客戶篩選函式，包含 property-based tests
 * （fast-check）驗證篩選結果之正確性與完整性（不多、不漏）。
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Customer } from '@/types/customer';
import type { Task } from '@/types/task';
import { filterCustomersByLocation, filterTasksByTime } from './mapFilter';

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

describe('filterTasksByTime', () => {
  const mk = (id: string, date: string, startTime: string, endTime: string, isOvernight = false) =>
    ({ id, date, startTime, endTime, isOvernight }) as unknown as Task;
  const tasks = [
    mk('a', '2026-11-16', '06:00', '08:00'),
    mk('b', '2026-11-16', '09:00', '10:00'),
    mk('c', '2026-11-17', '18:00', '22:00'),
    mk('d', '2026-11-17', '22:00', '02:00', true),
    mk('e', '2026-11-18', '', ''),
  ];
  const ids = (list: Task[]) => list.map((x) => x.id);

  it('filters by date range, inclusive on both ends', () => {
    expect(
      ids(filterTasksByTime(tasks, { startDate: '2026-11-16', endDate: '2026-11-16' })),
    ).toEqual(['a', 'b']);
    expect(
      ids(filterTasksByTime(tasks, { startDate: '2026-11-17', endDate: '2026-11-18' })),
    ).toEqual(['c', 'd', 'e']);
  });

  it('keeps tasks without a start time when no time window is set', () => {
    expect(ids(filterTasksByTime(tasks, {}))).toContain('e');
  });

  it('keeps tasks that overlap the time window and drops tasks without a start time', () => {
    expect(ids(filterTasksByTime(tasks, { startTime: '07:00', endTime: '09:30' }))).toEqual([
      'a',
      'b',
    ]);
    expect(ids(filterTasksByTime(tasks, { startTime: '12:00' }))).toEqual(['c', 'd']);
  });

  it('treats an overnight task as ending the next day', () => {
    expect(ids(filterTasksByTime(tasks, { startTime: '23:00', endTime: '23:30' }))).toEqual(['d']);
  });

  it('supports a window that crosses midnight', () => {
    expect(ids(filterTasksByTime(tasks, { startTime: '21:00', endTime: '01:00' }))).toEqual([
      'c',
      'd',
    ]);
  });
});
