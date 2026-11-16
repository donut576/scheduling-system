import { describe, it, expect } from 'vitest';
import { formatNotifyTime } from './notificationTime';

// 2026-11-13 15:00 (Asia/Taipei) = 07:00Z
const NOW = new Date('2026-11-13T07:00:00Z');

describe('formatNotifyTime', () => {
  it('今天只顯示時間', () => {
    expect(formatNotifyTime('2026-11-13T01:05:00Z', NOW)).toBe('09:05');
  });
  it('昨天顯示「昨天 + 時間」', () => {
    expect(formatNotifyTime('2026-11-12T10:30:00+08:00', NOW)).toBe('昨天 10:30');
  });
  it('前天（含）以前顯示 M/D + 時間', () => {
    expect(formatNotifyTime('2026-11-11T08:00:00+08:00', NOW)).toBe('11/11 08:00');
  });
  it('以日期而非 24 小時比較：昨天 23:50 在今天 00:10 看仍是昨天', () => {
    const now = new Date('2026-11-13T00:10:00+08:00');
    expect(formatNotifyTime('2026-11-12T23:50:00+08:00', now)).toBe('昨天 23:50');
  });
  it('無效或空值回傳空字串', () => {
    expect(formatNotifyTime(undefined, NOW)).toBe('');
    expect(formatNotifyTime('abc', NOW)).toBe('');
  });
});
