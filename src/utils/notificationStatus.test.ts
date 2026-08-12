import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { NotificationStatus } from '@/types/notification';
import {
  isValidNotificationStatus,
  isValidStatusTransition,
  NOTIFICATION_STATUS_TRANSITIONS,
  VALID_NOTIFICATION_STATUSES,
} from './notificationStatus';

/**
 * **Validates: Requirements 12.3**
 *
 * Property 24: 通知狀態合法性
 * 驗證：for any 通知記錄，狀態為合法值之一且轉換符合狀態機規則
 */

const arbValidStatus: fc.Arbitrary<NotificationStatus> = fc.constantFrom(
  ...VALID_NOTIFICATION_STATUSES,
);

describe('Property 24: 通知狀態合法性', () => {
  describe('isValidNotificationStatus', () => {
    it('對任意合法狀態值應回傳 true（round-trip 健全性檢查）', () => {
      fc.assert(
        fc.property(arbValidStatus, (status) => {
          expect(isValidNotificationStatus(status)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('對任意隨機字串（非四個合法值之一）應回傳 false', () => {
      fc.assert(
        fc.property(
          fc
            .string()
            .filter((s) => !(VALID_NOTIFICATION_STATUSES as readonly string[]).includes(s)),
          (randomString) => {
            expect(isValidNotificationStatus(randomString)).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('對任意非字串型別之值應回傳 false', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.object(),
            fc.array(fc.anything()),
          ),
          (value) => {
            expect(isValidNotificationStatus(value)).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('對四個合法狀態值逐一檢查應回傳 true', () => {
      for (const status of VALID_NOTIFICATION_STATUSES) {
        expect(isValidNotificationStatus(status)).toBe(true);
      }
    });
  });

  describe('isValidStatusTransition', () => {
    it('任意 (from, to) 狀態組合應與參考狀態機表格完全一致', () => {
      fc.assert(
        fc.property(arbValidStatus, arbValidStatus, (from, to) => {
          const expected = NOTIFICATION_STATUS_TRANSITIONS[from].includes(to);
          expect(isValidStatusTransition(from, to)).toBe(expected);
        }),
        { numRuns: 100 },
      );
    });

    it('窮舉所有 4x4=16 組合，驗證與狀態機表格逐一相符', () => {
      for (const from of VALID_NOTIFICATION_STATUSES) {
        for (const to of VALID_NOTIFICATION_STATUSES) {
          const expected = NOTIFICATION_STATUS_TRANSITIONS[from].includes(to);
          expect(isValidStatusTransition(from, to)).toBe(expected);
        }
      }
    });

    it('任意狀態轉換至自身應為不合法（狀態未變更不構成一次轉換）', () => {
      fc.assert(
        fc.property(arbValidStatus, (status) => {
          expect(isValidStatusTransition(status, status)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    describe('明確合法轉換案例', () => {
      it('NOT_NOTIFIED -> NOTIFIED 應合法', () => {
        expect(isValidStatusTransition('NOT_NOTIFIED', 'NOTIFIED')).toBe(true);
      });

      it('NOT_NOTIFIED -> CHANGED_NOT_NOTIFIED 應合法', () => {
        expect(isValidStatusTransition('NOT_NOTIFIED', 'CHANGED_NOT_NOTIFIED')).toBe(true);
      });

      it('NOTIFIED -> CHANGED_NOTIFIED 應合法', () => {
        expect(isValidStatusTransition('NOTIFIED', 'CHANGED_NOTIFIED')).toBe(true);
      });

      it('CHANGED_NOT_NOTIFIED -> CHANGED_NOTIFIED 應合法', () => {
        expect(isValidStatusTransition('CHANGED_NOT_NOTIFIED', 'CHANGED_NOTIFIED')).toBe(true);
      });

      it('CHANGED_NOTIFIED -> NOTIFIED 應合法', () => {
        expect(isValidStatusTransition('CHANGED_NOTIFIED', 'NOTIFIED')).toBe(true);
      });
    });

    describe('明確不合法轉換案例', () => {
      it('NOT_NOTIFIED -> CHANGED_NOTIFIED 應不合法（須先經過已通知或已變更未通知狀態）', () => {
        expect(isValidStatusTransition('NOT_NOTIFIED', 'CHANGED_NOTIFIED')).toBe(false);
      });

      it('CHANGED_NOT_NOTIFIED -> NOT_NOTIFIED 應不合法（不可退回未通知狀態）', () => {
        expect(isValidStatusTransition('CHANGED_NOT_NOTIFIED', 'NOT_NOTIFIED')).toBe(false);
      });

      it('NOTIFIED -> NOT_NOTIFIED 應不合法（不可退回未通知狀態）', () => {
        expect(isValidStatusTransition('NOTIFIED', 'NOT_NOTIFIED')).toBe(false);
      });
    });
  });
});
