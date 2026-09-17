import { describe, it, expect } from 'vitest';
import {
  checkCustomerDuplicate,
  isSimilarGroupName,
  normalizeGroupName,
  getLevenshteinDistance,
} from './customerValidation';

describe('customerValidation', () => {
  const existingGroups = [
    {
      name: '王品集團',
      branches: [{ name: '台北旗艦店' }, { name: '信義旗艦店' }],
    },
    {
      name: '乾杯燒肉集團',
      branches: [{ name: '新竹店' }],
    },
    {
      name: '鼎泰豐',
      branches: [{ name: '101店' }, { name: '復興店' }],
    },
  ];

  describe('normalizeGroupName', () => {
    it('removes common enterprise suffixes and whitespace', () => {
      expect(normalizeGroupName('王品集團')).toBe('王品');
      expect(normalizeGroupName('乾杯股份有限公司')).toBe('乾杯');
      expect(normalizeGroupName('  鼎泰豐 餐飲  ')).toBe('鼎泰豐');
    });
  });

  describe('isSimilarGroupName', () => {
    it('detects substring inclusion similarities', () => {
      expect(isSimilarGroupName('王品', '王品集團')).toBe(true);
      expect(isSimilarGroupName('王品集團', '王品')).toBe(true);
      expect(isSimilarGroupName('乾杯', '乾杯燒肉集團')).toBe(true);
    });

    it('detects normalized similarities', () => {
      expect(isSimilarGroupName('鼎泰豐企業', '鼎泰豐')).toBe(true);
    });

    it('returns false for unrelated names', () => {
      expect(isSimilarGroupName('麥當勞', '王品集團')).toBe(false);
      expect(isSimilarGroupName('摩斯漢堡', '鼎泰豐')).toBe(false);
    });
  });

  describe('getLevenshteinDistance', () => {
    it('calculates correct edit distance', () => {
      expect(getLevenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(getLevenshteinDistance('王品', '王品集團')).toBe(2);
      expect(getLevenshteinDistance('同', '同')).toBe(0);
    });
  });

  describe('checkCustomerDuplicate', () => {
    it('detects exact customer duplicates (group + branch)', () => {
      const result = checkCustomerDuplicate('王品集團', '台北旗艦店', existingGroups);
      expect(result.isExactCustomerDuplicate).toBe(true);
      expect(result.exactCustomerName).toBe('王品集團 - 台北旗艦店');
      expect(result.exactGroupMatch).toBeDefined();
      expect(result.exactGroupMatch?.name).toBe('王品集團');
      expect(result.exactGroupMatch?.branchCount).toBe(2);
    });

    it('detects exact group match when adding new branch', () => {
      const result = checkCustomerDuplicate('王品集團', '板橋新分店', existingGroups);
      expect(result.isExactCustomerDuplicate).toBe(false);
      expect(result.exactGroupMatch?.name).toBe('王品集團');
      expect(result.similarGroups).toHaveLength(0);
    });

    it('detects similar group when user inputs variant of existing group name', () => {
      const result = checkCustomerDuplicate('王品', '中正店', existingGroups);
      expect(result.isExactCustomerDuplicate).toBe(false);
      expect(result.exactGroupMatch).toBeUndefined();
      expect(result.similarGroups.length).toBeGreaterThanOrEqual(1);
      expect(result.similarGroups[0]?.name).toBe('王品集團');
    });

    it('returns empty result when input group name is blank', () => {
      const result = checkCustomerDuplicate('', '', existingGroups);
      expect(result.isExactCustomerDuplicate).toBe(false);
      expect(result.similarGroups).toHaveLength(0);
    });
  });
});
