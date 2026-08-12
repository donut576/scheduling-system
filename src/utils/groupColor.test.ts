/**
 * 測試對象：src/utils/groupColor.ts
 * 涵蓋 assignGroupColors 與 getGroupColor（含記憶化註冊表）之群組色彩指派邏輯，
 * 包含 property-based tests（fast-check）驗證色彩唯一性與指派結果之一致性。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  assignGroupColors,
  getGroupColor,
  resetGroupColorRegistry,
  GROUP_COLOR_PALETTE,
} from './groupColor';

/**
 * **Validates: Requirements 11.4**
 *
 * Property 21: 群組色彩唯一性
 * 驗證：for any 兩個不同員工群組，系統指派之色彩編碼互不相同
 */

// Generator for a set of distinct group identifiers, bounded by palette size
// so uniqueness is guaranteed by design (see groupColor.ts doc comments).
const arbDistinctGroupIds = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 10 }), {
  minLength: 0,
  maxLength: GROUP_COLOR_PALETTE.length,
});

describe('Property 21: 群組色彩唯一性', () => {
  it('assignGroupColors: 任意兩個不同群組 ID 所指派之色彩互不相同', () => {
    fc.assert(
      fc.property(arbDistinctGroupIds, (groupIds) => {
        const colorMap = assignGroupColors(groupIds);
        const colors = [...colorMap.values()];
        const uniqueColors = new Set(colors);

        // Number of unique colors assigned must equal number of distinct groups
        expect(uniqueColors.size).toBe(colorMap.size);
      }),
      { numRuns: 200 },
    );
  });

  it('assignGroupColors: 每個群組皆指派一個色彩編碼', () => {
    fc.assert(
      fc.property(arbDistinctGroupIds, (groupIds) => {
        const colorMap = assignGroupColors(groupIds);
        for (const groupId of groupIds) {
          expect(colorMap.has(groupId)).toBe(true);
          expect(typeof colorMap.get(groupId)).toBe('string');
        }
      }),
      { numRuns: 200 },
    );
  });

  it('assignGroupColors: 相同輸入多次呼叫結果一致（相同群組指派相同色彩）', () => {
    fc.assert(
      fc.property(arbDistinctGroupIds, (groupIds) => {
        const colorMap1 = assignGroupColors(groupIds);
        const colorMap2 = assignGroupColors(groupIds);

        for (const groupId of groupIds) {
          expect(colorMap1.get(groupId)).toBe(colorMap2.get(groupId));
        }
      }),
      { numRuns: 200 },
    );
  });

  describe('getGroupColor (memoized registry)', () => {
    beforeEach(() => {
      resetGroupColorRegistry();
    });

    it('任意兩個不同群組 ID（數量不超過調色盤大小）指派之色彩互不相同', () => {
      fc.assert(
        fc.property(arbDistinctGroupIds, (groupIds) => {
          resetGroupColorRegistry();
          const colors = groupIds.map((id) => getGroupColor(id));
          const uniqueColors = new Set(colors);
          expect(uniqueColors.size).toBe(groupIds.length);
        }),
        { numRuns: 200 },
      );
    });

    it('同一群組 ID 重複查詢應回傳相同色彩', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 10 }), (groupId) => {
          resetGroupColorRegistry();
          const color1 = getGroupColor(groupId);
          const color2 = getGroupColor(groupId);
          expect(color1).toBe(color2);
        }),
        { numRuns: 100 },
      );
    });
  });
});
