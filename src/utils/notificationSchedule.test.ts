/**
 * 測試對象：src/utils/notificationSchedule.ts
 * 涵蓋通知發送日期區間判斷（isManualSendWindow）、手動發送啟用邏輯
 * （isManualSendEnabled）與排班提醒日判斷（isScheduleReminderDay），
 * 包含 property-based tests（fast-check）與邊界日期案例測試。
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import dayjs from 'dayjs';
import {
  isManualSendWindow,
  isManualSendEnabled,
  isScheduleReminderDay,
} from './notificationSchedule';

/**
 * **Validates: Requirements 12.2**
 *
 * Property 23: 通知發送日期區間啟用
 * 驗證：for any 當月日期，手動發送啟用 iff 日期介於 20-31 日且存在新排班
 */

// Generator for arbitrary calendar dates, constrained to a reasonable range
// so day-of-month values span the full 1-31 space across different months.
const arbDate = fc
  .tuple(
    fc.integer({ min: 2000, max: 2100 }), // year
    fc.integer({ min: 0, max: 11 }), // month (0-indexed)
    fc.integer({ min: 1, max: 28 }), // day (28 avoids invalid dates like Feb 30)
  )
  .map(([year, month, day]) => dayjs(new Date(year, month, day)));

// Generator for arbitrary day-of-month values (1-31), combined with an
// arbitrary base month/year, to directly exercise the boundary of the
// manual-send window (20-31) regardless of how many days a given month has.
const arbDayOfMonth = fc
  .tuple(
    fc.integer({ min: 2000, max: 2100 }), // year
    fc.integer({ min: 0, max: 11 }), // month (0-indexed)
    fc.integer({ min: 1, max: 31 }), // day-of-month
  )
  .map(([year, month, day]) => dayjs(new Date(year, month, 1)).date(day));

describe('Property 23: 通知發送日期區間啟用', () => {
  it('isManualSendWindow(date) 應等於 true iff 日期介於每月 20-31 日之間', () => {
    fc.assert(
      fc.property(arbDayOfMonth, (date) => {
        const day = date.date();
        const expected = day >= 20 && day <= 31;
        expect(isManualSendWindow(date)).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('isManualSendEnabled(hasPendingNotifications, date) 應等於 true iff 日期介於 20-31 日且存在新排班（hasPendingNotifications 為 true）', () => {
    fc.assert(
      fc.property(arbDayOfMonth, fc.boolean(), (date, hasPendingNotifications) => {
        const day = date.date();
        const expected = day >= 20 && day <= 31 && hasPendingNotifications;
        expect(isManualSendEnabled(hasPendingNotifications, date)).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('任意日期 + 任意 hasPendingNotifications 組合皆與參考實作一致', () => {
    fc.assert(
      fc.property(arbDate, fc.boolean(), (date, hasPendingNotifications) => {
        const day = date.date();
        const expected = day >= 20 && day <= 31 && hasPendingNotifications;
        expect(isManualSendEnabled(hasPendingNotifications, date)).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  describe('邊界案例', () => {
    it('第 19 日（窗口開始前一日）：手動發送應停用', () => {
      const date = dayjs(new Date(2024, 4, 1)).date(19);
      expect(isManualSendWindow(date)).toBe(false);
      expect(isManualSendEnabled(true, date)).toBe(false);
    });

    it('第 20 日（窗口起始日）：若存在新排班則手動發送應啟用', () => {
      const date = dayjs(new Date(2024, 4, 1)).date(20);
      expect(isManualSendWindow(date)).toBe(true);
      expect(isManualSendEnabled(true, date)).toBe(true);
      expect(isManualSendEnabled(false, date)).toBe(false);
    });

    it('第 31 日（窗口結束日）：若存在新排班則手動發送應啟用', () => {
      const date = dayjs(new Date(2024, 0, 31)).date(31);
      expect(isManualSendWindow(date)).toBe(true);
      expect(isManualSendEnabled(true, date)).toBe(true);
      expect(isManualSendEnabled(false, date)).toBe(false);
    });

    it('第 1 日（月初）：手動發送應停用，即使存在新排班', () => {
      const date = dayjs(new Date(2024, 4, 1)).date(1);
      expect(isManualSendWindow(date)).toBe(false);
      expect(isManualSendEnabled(true, date)).toBe(false);
    });
  });
});

describe('isScheduleReminderDay', () => {
  it('每月十五日應回傳 true，其他日期應回傳 false', () => {
    fc.assert(
      fc.property(arbDayOfMonth, (date) => {
        expect(isScheduleReminderDay(date)).toBe(date.date() === 15);
      }),
      { numRuns: 200 },
    );
  });
});
