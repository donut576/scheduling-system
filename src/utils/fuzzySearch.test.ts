import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterByKeyword } from './fuzzySearch';

/**
 * Property 10: 模糊搜尋結果正確性
 * **Validates: Requirements 4.2, 10.4**
 *
 * For any 搜尋關鍵字，結果中每筆記錄之集團或分店名稱包含該關鍵字（不區分大小寫）
 */
describe('Property 10: 模糊搜尋結果正確性', () => {
  // Generator for searchable records
  const recordArb = fc.record({
    groupName: fc.string({ minLength: 0, maxLength: 50 }),
    branchName: fc.string({ minLength: 0, maxLength: 50 }),
  });

  const recordsArb = fc.array(recordArb, { minLength: 0, maxLength: 50 });
  const keywordArb = fc.string({ minLength: 1, maxLength: 20 });

  it('every record in the result contains the keyword in groupName or branchName (case-insensitive)', () => {
    fc.assert(
      fc.property(recordsArb, keywordArb, (records, keyword) => {
        const results = filterByKeyword(records, keyword);
        const lowerKeyword = keyword.toLowerCase();

        // Every record in the result must contain the keyword in groupName or branchName
        for (const record of results) {
          const matchesGroup = record.groupName.toLowerCase().includes(lowerKeyword);
          const matchesBranch = record.branchName.toLowerCase().includes(lowerKeyword);
          expect(matchesGroup || matchesBranch).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('no record matching the criteria is excluded from the result (completeness)', () => {
    fc.assert(
      fc.property(recordsArb, keywordArb, (records, keyword) => {
        const results = filterByKeyword(records, keyword);
        const lowerKeyword = keyword.toLowerCase();

        // Every record that matches the criteria must be in the result
        for (const record of records) {
          const matchesGroup = record.groupName.toLowerCase().includes(lowerKeyword);
          const matchesBranch = record.branchName.toLowerCase().includes(lowerKeyword);

          if (matchesGroup || matchesBranch) {
            expect(results).toContain(record);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it('result is a subset of the input records', () => {
    fc.assert(
      fc.property(recordsArb, keywordArb, (records, keyword) => {
        const results = filterByKeyword(records, keyword);

        // Every result record must be in the original records
        for (const record of results) {
          expect(records).toContain(record);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('empty keyword returns all records', () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const results = filterByKeyword(records, '');
        expect(results).toEqual(records);
      }),
      { numRuns: 100 },
    );
  });
});
