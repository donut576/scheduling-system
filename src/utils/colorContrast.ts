/**
 * Color Contrast Utility
 *
 * Implements WCAG 2.1 contrast ratio calculation for verifying
 * accessibility compliance of design token color combinations.
 */

/**
 * Parse a hex color string to RGB components.
 * Supports both 3-digit (#RGB) and 6-digit (#RRGGBB) formats.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');

  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(cleaned)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }

  let r: number, g: number, b: number;

  if (cleaned.length === 3) {
    // Regex above already guarantees exactly 3 hex characters, so these
    // indexed accesses are safe despite noUncheckedIndexedAccess.
    const c0 = cleaned[0] as string;
    const c1 = cleaned[1] as string;
    const c2 = cleaned[2] as string;
    r = parseInt(c0 + c0, 16);
    g = parseInt(c1 + c1, 16);
    b = parseInt(c2 + c2, 16);
  } else {
    r = parseInt(cleaned.substring(0, 2), 16);
    g = parseInt(cleaned.substring(2, 4), 16);
    b = parseInt(cleaned.substring(4, 6), 16);
  }

  return { r, g, b };
}

/**
 * Convert an sRGB color channel value (0-255) to relative luminance component.
 * Uses the WCAG 2.1 formula for linearizing sRGB values.
 */
export function linearize(channel: number): number {
  const sRGB = channel / 255;
  return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
}

/**
 * Calculate the relative luminance of a color.
 * Based on WCAG 2.1 definition:
 * L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Calculate the contrast ratio between two colors.
 * Returns a value between 1 and 21.
 * WCAG AA requires ≥ 4.5:1 for normal text.
 */
export function calculateContrastRatio(color1: string, color2: string): number {
  const l1 = getRelativeLuminance(color1);
  const l2 = getRelativeLuminance(color2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a foreground/background color pair meets WCAG AA contrast requirements.
 * Normal text requires ≥ 4.5:1.
 * Large text requires ≥ 3:1.
 */
export function meetsWcagAA(foreground: string, background: string, isLargeText = false): boolean {
  const ratio = calculateContrastRatio(foreground, background);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}
