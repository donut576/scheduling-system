import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { AuditActionType, AuditLogContext } from '@/types/audit';
import { AUDITABLE_ACTION_TYPES, createAuditLogEntry, isAuditableAction } from './auditLog';

/**
 * **Validates: Requirements 13.4**
 *
 * Property 25: 稽核日誌建立
 * 驗證：for any 可稽核操作（排班變更、警示覆蓋、權限變更、刪除），
 * 系統應建立對應之稽核日誌記錄，包含操作類型、操作者、時間戳與變更內容。
 */

// ISO 8601 regex with timezone offset (e.g., 2026-08-10T09:00:00+08:00)
const iso8601WithTimezoneRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

const arbAuditableActionType: fc.Arbitrary<AuditActionType> = fc.constantFrom(
  ...AUDITABLE_ACTION_TYPES,
);

const arbAuditLogContext: fc.Arbitrary<AuditLogContext> = fc.record({
  operatorId: fc.string({ minLength: 1, maxLength: 20 }),
  operatorName: fc.string({ minLength: 1, maxLength: 20 }),
  targetId: fc.string({ minLength: 1, maxLength: 20 }),
  targetType: fc.constantFrom('SCHEDULE', 'ALERT', 'PERMISSION', 'EMPLOYEE', 'TASK'),
  details: fc.dictionary(
    fc.string({ minLength: 1, maxLength: 10 }),
    fc.oneof(fc.string(), fc.integer(), fc.boolean()),
  ),
});

describe('Property 25: 稽核日誌建立', () => {
  describe('createAuditLogEntry', () => {
    it('對任意可稽核操作類型與上下文，應建立包含正確 actionType 之記錄', () => {
      fc.assert(
        fc.property(arbAuditableActionType, arbAuditLogContext, (actionType, context) => {
          const entry = createAuditLogEntry(actionType, context);
          expect(entry.actionType).toBe(actionType);
        }),
        { numRuns: 100 },
      );
    });

    it('對任意可稽核操作類型與上下文，應產生非空之 id', () => {
      fc.assert(
        fc.property(arbAuditableActionType, arbAuditLogContext, (actionType, context) => {
          const entry = createAuditLogEntry(actionType, context);
          expect(typeof entry.id).toBe('string');
          expect(entry.id.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });

    it('對任意可稽核操作類型與上下文，應產生符合 ISO 8601 格式（含時區）之時間戳', () => {
      fc.assert(
        fc.property(arbAuditableActionType, arbAuditLogContext, (actionType, context) => {
          const entry = createAuditLogEntry(actionType, context);
          expect(entry.timestamp).toMatch(iso8601WithTimezoneRegex);
        }),
        { numRuns: 100 },
      );
    });

    it('對任意可稽核操作類型與上下文，應保留 operatorId、operatorName、targetId、targetType、details', () => {
      fc.assert(
        fc.property(arbAuditableActionType, arbAuditLogContext, (actionType, context) => {
          const entry = createAuditLogEntry(actionType, context);
          expect(entry.operatorId).toBe(context.operatorId);
          expect(entry.operatorName).toBe(context.operatorName);
          expect(entry.targetId).toBe(context.targetId);
          expect(entry.targetType).toBe(context.targetType);
          expect(entry.details).toEqual(context.details);
        }),
        { numRuns: 100 },
      );
    });

    it('對每個合法可稽核操作類型逐一檢查應正確建立記錄', () => {
      const context: AuditLogContext = {
        operatorId: 'op-1',
        operatorName: '王經理',
        targetId: 'target-1',
        targetType: 'SCHEDULE',
        details: { field: 'startTime', before: '09:00', after: '10:00' },
      };

      for (const actionType of AUDITABLE_ACTION_TYPES) {
        const entry = createAuditLogEntry(actionType, context);
        expect(entry.actionType).toBe(actionType);
        expect(entry.operatorId).toBe(context.operatorId);
        expect(entry.timestamp).toMatch(iso8601WithTimezoneRegex);
      }
    });
  });

  describe('isAuditableAction', () => {
    it('對任意合法可稽核操作類型應回傳 true（round-trip 健全性檢查）', () => {
      fc.assert(
        fc.property(arbAuditableActionType, (actionType) => {
          expect(isAuditableAction(actionType)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('對任意隨機字串（非四個合法值之一）應回傳 false', () => {
      fc.assert(
        fc.property(
          fc.string().filter((s) => !(AUDITABLE_ACTION_TYPES as readonly string[]).includes(s)),
          (randomString) => {
            expect(isAuditableAction(randomString)).toBe(false);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('對四個合法可稽核操作類型逐一檢查應回傳 true', () => {
      for (const actionType of AUDITABLE_ACTION_TYPES) {
        expect(isAuditableAction(actionType)).toBe(true);
      }
    });

    it('對明確之非可稽核字串應回傳 false', () => {
      expect(isAuditableAction('LOGIN')).toBe(false);
      expect(isAuditableAction('VIEW')).toBe(false);
      expect(isAuditableAction('')).toBe(false);
    });
  });
});
