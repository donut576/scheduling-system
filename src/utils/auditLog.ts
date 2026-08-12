import type { AuditActionType, AuditLogContext, AuditLogEntry } from '@/types/audit';
import { formatDateTime } from './date';

/** 所有合法之可稽核操作類型 (Requirement 13.4) */
export const AUDITABLE_ACTION_TYPES: readonly AuditActionType[] = [
  'SCHEDULE_CHANGE',
  'ALERT_OVERRIDE',
  'PERMISSION_CHANGE',
  'DELETE',
] as const;

/**
 * 檢查傳入值是否為合法之可稽核操作類型。
 *
 * @param actionType 任意值
 * @returns 若 actionType 為四個合法可稽核操作類型之一則回傳 true，否則回傳 false
 */
export function isAuditableAction(actionType: string): actionType is AuditActionType {
  return (AUDITABLE_ACTION_TYPES as readonly string[]).includes(actionType);
}

/**
 * 產生稽核日誌記錄之唯一識別碼。
 */
function generateAuditLogId(): string {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `audit-${randomPart}`;
}

/**
 * 建立稽核日誌記錄 (Requirement 13.4)
 *
 * 針對可稽核操作（排班變更、警示覆蓋、權限變更、刪除），
 * 建立包含操作類型、操作者、時間戳與變更內容之稽核日誌記錄。
 *
 * @param actionType 可稽核操作類型
 * @param context 操作上下文（操作者資訊、目標資訊、變更內容）
 * @returns 完整之稽核日誌記錄
 */
export function createAuditLogEntry(
  actionType: AuditActionType,
  context: AuditLogContext,
): AuditLogEntry {
  return {
    id: generateAuditLogId(),
    actionType,
    operatorId: context.operatorId,
    operatorName: context.operatorName,
    timestamp: formatDateTime(new Date()),
    targetId: context.targetId,
    targetType: context.targetType,
    details: context.details,
  };
}
