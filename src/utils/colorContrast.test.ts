/**
 * 測試對象：src/utils/colorContrast.ts
 * 涵蓋 hex 轉 RGB、線性化、相對亮度、對比度比值計算及 WCAG AA 合規檢查，
 * 包含一般案例測試與 property-based tests（fast-check）驗證數學性質
 * （對稱性、範圍界限等）與設計 Token 實際色彩組合之合規性。
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  hexToRgb,
  linearize,
  getRelativeLuminance,
  calculateContrastRatio,
  meetsWcagAA,
} from './colorContrast';
import { designTokens } from '@/styles/tokens';

/**
 * **Validates: Requirements 16.6**
 *
 * Property 28: 色彩對比度合規
 * For any 設計 Token 中之前景/背景色彩組合，計算之對比度比值應 ≥ 4.5:1，
 * 符合 WCAG AA 等級要求。
 */

// Helper: generate valid hex color strings for property tests
const hexColorArb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
  )
  .map(
    ([r, g, b]) =>
      `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
  );

describe('colorContrast - unit tests', () => {
  describe('hexToRgb', () => {
    it('parses 6-digit hex correctly', () => {
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('parses 3-digit hex correctly', () => {
      expect(hexToRgb('#F00')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('throws for invalid hex', () => {
      expect(() => hexToRgb('#GG0000')).toThrow();
      expect(() => hexToRgb('#12')).toThrow();
    });
  });

  describe('linearize', () => {
    it('returns 0 for channel value 0', () => {
      expect(linearize(0)).toBe(0);
    });

    it('returns 1 for channel value 255', () => {
      expect(linearize(255)).toBeCloseTo(1, 5);
    });
  });

  describe('getRelativeLuminance', () => {
    it('returns 0 for black', () => {
      expect(getRelativeLuminance('#000000')).toBeCloseTo(0, 5);
    });

    it('returns 1 for white', () => {
      expect(getRelativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    });
  });

  describe('calculateContrastRatio', () => {
    it('returns 21 for black on white', () => {
      expect(calculateContrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    });

    it('returns 1 for same colors', () => {
      expect(calculateContrastRatio('#FF0000', '#FF0000')).toBeCloseTo(1, 5);
    });
  });

  describe('meetsWcagAA', () => {
    it('returns true for black on white (21:1)', () => {
      expect(meetsWcagAA('#000000', '#FFFFFF')).toBe(true);
    });

    it('returns false for low contrast pair', () => {
      expect(meetsWcagAA('#777777', '#888888')).toBe(false);
    });
  });
});

describe('colorContrast - property tests', () => {
  /**
   * **Validates: Requirements 16.6**
   *
   * Property: Contrast ratio is always between 1 and 21 (inclusive).
   */
  it('contrast ratio is always between 1 and 21', () => {
    fc.assert(
      fc.property(hexColorArb, hexColorArb, (color1, color2) => {
        const ratio = calculateContrastRatio(color1, color2);
        expect(ratio).toBeGreaterThanOrEqual(1);
        expect(ratio).toBeLessThanOrEqual(21);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 16.6**
   *
   * Property: Contrast ratio is symmetric - order of colors doesn't matter.
   */
  it('contrast ratio is symmetric', () => {
    fc.assert(
      fc.property(hexColorArb, hexColorArb, (color1, color2) => {
        const ratio1 = calculateContrastRatio(color1, color2);
        const ratio2 = calculateContrastRatio(color2, color1);
        expect(ratio1).toBeCloseTo(ratio2, 10);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 16.6**
   *
   * Property: Same color always has contrast ratio of 1.
   */
  it('same color has contrast ratio of 1', () => {
    fc.assert(
      fc.property(hexColorArb, (color) => {
        const ratio = calculateContrastRatio(color, color);
        expect(ratio).toBeCloseTo(1, 5);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 16.6**
   *
   * Property: Relative luminance is always between 0 and 1.
   */
  it('relative luminance is always between 0 and 1', () => {
    fc.assert(
      fc.property(hexColorArb, (color) => {
        const luminance = getRelativeLuminance(color);
        expect(luminance).toBeGreaterThanOrEqual(0);
        expect(luminance).toBeLessThanOrEqual(1);
      }),
      { numRuns: 200 },
    );
  });

  /**
   * **Validates: Requirements 16.6**
   *
   * Property 28: 色彩對比度合規 - All design token foreground/background combinations
   * must have contrast ratio ≥ 4.5:1 (WCAG AA).
   */
  it('all design token text colors on backgrounds meet WCAG AA (≥ 4.5:1)', () => {
    const { colors } = designTokens;

    // Define foreground colors (text colors used for content)
    const foregroundColors = [
      { name: 'textPrimary', value: colors.textPrimary },
      { name: 'textSecondary', value: colors.textSecondary },
    ];

    // Define background colors (surfaces where text is rendered)
    const backgroundColors = [
      { name: 'white', value: colors.white },
      { name: 'background', value: colors.background },
    ];

    for (const fg of foregroundColors) {
      for (const bg of backgroundColors) {
        const ratio = calculateContrastRatio(fg.value, bg.value);
        expect(
          ratio,
          `${fg.name} (${fg.value}) on ${bg.name} (${bg.value}) has contrast ratio ${ratio.toFixed(2)}:1, expected ≥ 4.5:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  /**
   * **Validates: Requirements 16.6**
   *
   * Property 28 (extended): Primary color on white background meets WCAG AA
   * for interactive elements like links and buttons.
   */
  it('primary color on white background meets WCAG AA for interactive elements', () => {
    const { colors } = designTokens;
    const ratio = calculateContrastRatio(colors.primary, colors.white);
    expect(
      ratio,
      `primary (${colors.primary}) on white (${colors.white}) has contrast ratio ${ratio.toFixed(2)}:1, expected ≥ 4.5:1`,
    ).toBeGreaterThanOrEqual(4.5);
  });
});
