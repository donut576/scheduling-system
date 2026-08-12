/**
 * 測試對象：src/utils/pendingCustomerConversion.ts
 * 涵蓋 buildConvertedTaskData 待定客戶轉換函式，包含 property-based tests
 * （fast-check）驗證集團/分店識別資訊保留、確認值覆蓋原始值等轉換正確性。
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { PendingCustomer, PendingCustomerStatus } from '@/types/customer';
import type { ConvertToTaskData } from '@/api/pending-customer';
import { buildConvertedTaskData } from './pendingCustomerConversion';

/**
 * **Validates: Requirements 14.3**
 *
 * Property 26: 待定客戶轉換正確性
 * 驗證：for any 待定客戶轉換，保留原始集團/分店/聯絡人，日期時間符合確認值
 */

const arbPendingCustomerStatus: fc.Arbitrary<PendingCustomerStatus> = fc.constantFrom(
  'PENDING',
  'CONFIRMED',
  'CONVERTED',
);

// Arbitrary date/time strings independent of the confirmed values, so that
// generated pending customer records may or may not overlap with the
// confirmed conversion values (used to prove they are NOT merely copied through).
const arbDateString = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

const arbTimeString = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

const arbPendingCustomer: fc.Arbitrary<PendingCustomer> = fc.record({
  id: fc.uuid(),
  groupId: fc.string({ minLength: 1, maxLength: 20 }),
  groupName: fc.string({ minLength: 1, maxLength: 30 }),
  branchId: fc.string({ minLength: 1, maxLength: 20 }),
  branchName: fc.string({ minLength: 1, maxLength: 30 }),
  status: arbPendingCustomerStatus,
  date: fc.option(arbDateString, { nil: undefined }),
  startTime: fc.option(arbTimeString, { nil: undefined }),
  endTime: fc.option(arbTimeString, { nil: undefined }),
  headcount: fc.integer({ min: 1, max: 50 }),
  shift: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
  remarks: fc.option(fc.string({ maxLength: 50 }), { nil: undefined }),
  createdAt: fc.date().map((d) => d.toISOString()),
  updatedAt: fc.date().map((d) => d.toISOString()),
});

const arbConvertToTaskData: fc.Arbitrary<ConvertToTaskData> = fc.record({
  date: arbDateString,
  startTime: arbTimeString,
  endTime: arbTimeString,
  shift: fc.string({ minLength: 1, maxLength: 10 }),
  headcount: fc.integer({ min: 1, max: 50 }),
});

describe('Property 26: 待定客戶轉換正確性', () => {
  it('轉換結果應保留原始待定客戶之集團/分店識別資訊', () => {
    fc.assert(
      fc.property(arbPendingCustomer, arbConvertToTaskData, (pendingCustomer, confirmedValues) => {
        const result = buildConvertedTaskData(pendingCustomer, confirmedValues);

        expect(result.groupId).toBe(pendingCustomer.groupId);
        expect(result.groupName).toBe(pendingCustomer.groupName);
        expect(result.branchId).toBe(pendingCustomer.branchId);
        expect(result.branchName).toBe(pendingCustomer.branchName);
      }),
      { numRuns: 100 },
    );
  });

  it('轉換結果之日期/時間/班別/人數應完全符合確認值，即使與原始待定客戶值不同', () => {
    fc.assert(
      fc.property(arbPendingCustomer, arbConvertToTaskData, (pendingCustomer, confirmedValues) => {
        const result = buildConvertedTaskData(pendingCustomer, confirmedValues);

        expect(result.date).toBe(confirmedValues.date);
        expect(result.startTime).toBe(confirmedValues.startTime);
        expect(result.endTime).toBe(confirmedValues.endTime);
        expect(result.shift).toBe(confirmedValues.shift);
        expect(result.headcount).toBe(confirmedValues.headcount);
      }),
      { numRuns: 100 },
    );
  });

  it('即使原始待定客戶已有自己的日期/時間值且與確認值不同，結果仍以確認值為準', () => {
    fc.assert(
      fc.property(
        arbPendingCustomer,
        arbConvertToTaskData,
        fc.constantFrom('OVERRIDE_DIFFERENT', 'KEEP_UNDEFINED'),
        (pendingCustomer, confirmedValues, mode) => {
          // Force the pending customer to carry values that intentionally
          // differ from the confirmed values, to prove the function does not
          // simply fall back to the pending customer's own values.
          const differingDate = confirmedValues.date === '2020-01-01' ? '2020-01-02' : '2020-01-01';
          const record: PendingCustomer =
            mode === 'OVERRIDE_DIFFERENT'
              ? { ...pendingCustomer, date: differingDate }
              : { ...pendingCustomer, date: undefined };

          const result = buildConvertedTaskData(record, confirmedValues);

          expect(result.date).toBe(confirmedValues.date);
        },
      ),
      { numRuns: 100 },
    );
  });
});
