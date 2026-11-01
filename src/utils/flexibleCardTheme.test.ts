import { describe, it, expect } from 'vitest';
import { getFlexibleCardTheme } from './flexibleCardTheme';

describe('getFlexibleCardTheme', () => {
  it('以原色產生虛線框色與淡色斜紋底', () => {
    const theme = getFlexibleCardTheme('#6a58a8');
    expect(theme.border).toBe('#6a58a8');
    expect(theme.badgeBg).toBe('#6a58a8');
    expect(theme.backgroundImage).toContain('repeating-linear-gradient');
  });

  it('非 hex 色碼時退回中性灰', () => {
    expect(getFlexibleCardTheme('rgb(1,2,3)').border).toBe('#8c8c8c');
  });
});
