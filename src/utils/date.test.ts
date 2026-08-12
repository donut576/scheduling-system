/**
 * 測試對象：src/utils/date.ts
 * 涵蓋日期時間格式化、跨日（夜班）判斷、時長計算、時段重疊偵測、
 * 連續工作天數計算等函式，包含一般案例測試與 property-based tests
 * （fast-check）驗證跨日邊界與 ISO 8601 格式等演算法性質。
 */
import { describe, it, expect } from 'vitest';
import {
  isOvernight,
  calculateDuration,
  isTimeOverlap,
  isTimeStringOverlap,
  getMaxConsecutiveDays,
  isHoliday,
  formatDate,
  formatDateTime,
  formatTime,
  getDayOfMonth,
} from './date';

describe('isOvernight', () => {
  it('returns false for normal daytime range', () => {
    expect(isOvernight('09:00', '17:00')).toBe(false);
  });

  it('returns true when end time is less than start time', () => {
    expect(isOvernight('22:00', '06:00')).toBe(true);
  });

  it('returns true when end time equals start time', () => {
    expect(isOvernight('08:00', '08:00')).toBe(true);
  });
});

describe('calculateDuration', () => {
  it('calculates normal daytime duration', () => {
    expect(calculateDuration('09:00', '17:00')).toBe(8);
  });

  it('calculates overnight duration', () => {
    expect(calculateDuration('22:00', '06:00')).toBe(8);
  });

  it('calculates short duration', () => {
    expect(calculateDuration('14:00', '14:30')).toBe(0.5);
  });

  it('calculates full 24-hour duration when times are equal', () => {
    expect(calculateDuration('08:00', '08:00')).toBe(24);
  });
});

describe('isTimeOverlap', () => {
  it('detects overlapping intervals', () => {
    expect(isTimeOverlap(60, 180, 120, 240)).toBe(true);
  });

  it('returns false for non-overlapping intervals', () => {
    expect(isTimeOverlap(60, 120, 180, 240)).toBe(false);
  });

  it('returns false for adjacent intervals (no overlap)', () => {
    expect(isTimeOverlap(60, 120, 120, 180)).toBe(false);
  });
});

describe('isTimeStringOverlap', () => {
  it('detects overlapping normal time ranges', () => {
    expect(isTimeStringOverlap('09:00', '12:00', '11:00', '14:00')).toBe(true);
  });

  it('returns false for non-overlapping normal ranges', () => {
    expect(isTimeStringOverlap('09:00', '12:00', '13:00', '15:00')).toBe(false);
  });

  it('detects overlap when first is overnight and second is in morning', () => {
    expect(isTimeStringOverlap('22:00', '06:00', '03:00', '08:00')).toBe(true);
  });

  it('detects overlap when first is overnight and second is in evening', () => {
    expect(isTimeStringOverlap('22:00', '06:00', '21:00', '23:00')).toBe(true);
  });

  it('returns false when overnight and normal do not overlap', () => {
    expect(isTimeStringOverlap('22:00', '06:00', '08:00', '12:00')).toBe(false);
  });

  it('both overnight always overlap', () => {
    expect(isTimeStringOverlap('22:00', '06:00', '23:00', '05:00')).toBe(true);
  });
});

describe('getMaxConsecutiveDays', () => {
  it('returns 1 for a single date', () => {
    expect(getMaxConsecutiveDays([], '2025-01-15')).toBe(1);
  });

  it('returns correct consecutive count', () => {
    const dates = ['2025-01-01', '2025-01-02', '2025-01-03'];
    expect(getMaxConsecutiveDays(dates, '2025-01-04')).toBe(4);
  });

  it('handles non-consecutive dates', () => {
    const dates = ['2025-01-01', '2025-01-03', '2025-01-05'];
    expect(getMaxConsecutiveDays(dates, '2025-01-06')).toBe(2);
  });

  it('deduplicates existing dates', () => {
    const dates = ['2025-01-01', '2025-01-01', '2025-01-02'];
    expect(getMaxConsecutiveDays(dates, '2025-01-03')).toBe(3);
  });

  it('returns 8 for eight consecutive days', () => {
    const dates = [
      '2025-01-01',
      '2025-01-02',
      '2025-01-03',
      '2025-01-04',
      '2025-01-05',
      '2025-01-06',
      '2025-01-07',
    ];
    expect(getMaxConsecutiveDays(dates, '2025-01-08')).toBe(8);
  });
});

describe('isHoliday', () => {
  it('returns true if date is in holiday list', () => {
    const holidays = ['2025-01-01', '2025-02-28'];
    expect(isHoliday('2025-01-01', holidays)).toBe(true);
  });

  it('returns false if date is not in holiday list', () => {
    const holidays = ['2025-01-01', '2025-02-28'];
    expect(isHoliday('2025-01-15', holidays)).toBe(false);
  });
});

describe('formatDate', () => {
  it('formats date to default YYYY-MM-DD', () => {
    expect(formatDate('2025-06-15T10:00:00Z')).toBe('2025-06-15');
  });

  it('formats date with custom format', () => {
    expect(formatDate('2025-06-15', 'YYYY/MM/DD')).toBe('2025/06/15');
  });
});

describe('formatDateTime', () => {
  it('formats date to ISO 8601 with timezone', () => {
    const result = formatDateTime('2025-06-15T02:00:00Z');
    expect(result).toMatch(/2025-06-15T10:00:00\+08:00/);
  });
});

describe('formatTime', () => {
  it('returns time as-is', () => {
    expect(formatTime('09:30')).toBe('09:30');
  });
});

describe('getDayOfMonth', () => {
  it('returns day of month for a given date', () => {
    expect(getDayOfMonth('2025-01-15')).toBe(15);
  });
});

import fc from 'fast-check';

/**
 * Property 7: 跨日時間區間計算
 * For any 起訖時間組合（包含跨日情境），系統計算之時間長度應正確反映實際工時：
 * 若 endTime ≤ startTime 則視為跨日，時長 = (24:00 - startTime) + endTime
 *
 * **Validates: Requirements 3.4**
 */
describe('Property 7: 跨日時間區間計算', () => {
  // Generator for valid HH:mm time strings (00:00 - 23:59)
  const timeStringArb = fc
    .record({
      hour: fc.integer({ min: 0, max: 23 }),
      minute: fc.integer({ min: 0, max: 59 }),
    })
    .map(({ hour, minute }) => {
      const hh = hour.toString().padStart(2, '0');
      const mm = minute.toString().padStart(2, '0');
      return hh + ':' + mm;
    });

  const toMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h! * 60 + m!;
  };

  it('should calculate overnight duration correctly when endTime <= startTime', () => {
    fc.assert(
      fc.property(timeStringArb, timeStringArb, (startTime, endTime) => {
        const startMinutes = toMinutes(startTime);
        const endMinutes = toMinutes(endTime);

        // Only test overnight case: endTime <= startTime
        fc.pre(endMinutes <= startMinutes);

        const duration = calculateDuration(startTime, endTime);
        const expectedDuration = (1440 - startMinutes + endMinutes) / 60;

        expect(duration).toBeCloseTo(expectedDuration, 10);
      }),
      { numRuns: 200 },
    );
  });

  it('should calculate same-day duration correctly when endTime > startTime', () => {
    fc.assert(
      fc.property(timeStringArb, timeStringArb, (startTime, endTime) => {
        const startMinutes = toMinutes(startTime);
        const endMinutes = toMinutes(endTime);

        // Only test same-day case: endTime > startTime
        fc.pre(endMinutes > startMinutes);

        const duration = calculateDuration(startTime, endTime);
        const expectedDuration = (endMinutes - startMinutes) / 60;

        expect(duration).toBeCloseTo(expectedDuration, 10);
      }),
      { numRuns: 200 },
    );
  });

  it('should always produce a positive duration for any time pair', () => {
    fc.assert(
      fc.property(timeStringArb, timeStringArb, (startTime, endTime) => {
        const duration = calculateDuration(startTime, endTime);
        expect(duration).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });

  it('should agree with isOvernight on whether the interval crosses midnight', () => {
    fc.assert(
      fc.property(timeStringArb, timeStringArb, (startTime, endTime) => {
        const startMinutes = toMinutes(startTime);
        const endMinutes = toMinutes(endTime);
        const overnight = isOvernight(startTime, endTime);

        // isOvernight returns true when endMinutes <= startMinutes
        expect(overnight).toBe(endMinutes <= startMinutes);
      }),
      { numRuns: 200 },
    );
  });
});

/**
 * Property 30: ISO 8601 日期格式
 * For any 系統產生之日期時間值，格式符合 ISO 8601 並包含時區資訊
 * (e.g., "2026-08-10T09:00:00+08:00")
 *
 * **Validates: Requirements 18.4**
 */
describe('Property 30: ISO 8601 日期格式', () => {
  // ISO 8601 regex with timezone offset (e.g., 2026-08-10T09:00:00+08:00)
  const iso8601WithTimezoneRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

  // Generator for arbitrary valid dates
  const datePartsArb = fc.record({
    year: fc.integer({ min: 2000, max: 2099 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid day-of-month issues
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
    second: fc.integer({ min: 0, max: 59 }),
  });

  it('should produce output matching ISO 8601 format with timezone offset for any valid date', () => {
    fc.assert(
      fc.property(datePartsArb, ({ year, month, day, hour, minute, second }) => {
        // Build an ISO date string in UTC to pass to formatDateTime
        const isoInput = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}Z`;

        const result = formatDateTime(isoInput);

        expect(result).toMatch(iso8601WithTimezoneRegex);
      }),
      { numRuns: 200 },
    );
  });

  it('should always include a timezone offset in the output', () => {
    fc.assert(
      fc.property(datePartsArb, ({ year, month, day, hour, minute, second }) => {
        const isoInput = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}Z`;

        const result = formatDateTime(isoInput);

        // Verify the timezone offset portion exists (+ or - followed by HH:MM)
        const timezoneMatch = result.match(/[+-]\d{2}:\d{2}$/);
        expect(timezoneMatch).not.toBeNull();
      }),
      { numRuns: 200 },
    );
  });

  it('should produce a valid parseable date-time from any input', () => {
    fc.assert(
      fc.property(datePartsArb, ({ year, month, day, hour, minute, second }) => {
        const isoInput = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}Z`;

        const result = formatDateTime(isoInput);

        // The output should be parseable back to a valid Date
        const parsed = new Date(result);
        expect(parsed.toString()).not.toBe('Invalid Date');
      }),
      { numRuns: 200 },
    );
  });
});
