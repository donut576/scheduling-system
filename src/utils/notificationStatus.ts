import type { NotificationStatus } from '@/types/notification';

/**
 * 通知狀態機規則 (Requirement 12.3)
 *
 * 業務語意：
 * - NOT_NOTIFIED（未通知）：排班已建立，尚未發送通知
 * - NOTIFIED（已通知）：通知已成功發送予客戶/員工
 * - CHANGED_NOT_NOTIFIED（已變更+未通知）：排班在通知前已再次變更，
 *   仍處於待通知狀態（無論此前是否已通知過）
 * - CHANGED_NOTIFIED（已變更+已通知）：排班變更後之新通知已重新發送完成
 *
 * 合法轉換規則：
 * - NOT_NOTIFIED -> NOTIFIED
 *   （通知已發送）
 * - NOT_NOTIFIED -> CHANGED_NOT_NOTIFIED
 *   （排班在通知前已變更，仍待通知）
 * - NOTIFIED -> CHANGED_NOTIFIED
 *   （已通知後排班變更，需重新通知/追蹤 — 系統會自動觸發重新發送，
 *   因此直接視為已變更+已通知）
 * - NOTIFIED -> CHANGED_NOT_NOTIFIED
 *   （已通知後排班變更，但尚未完成重新通知）
 * - CHANGED_NOT_NOTIFIED -> CHANGED_NOTIFIED
 *   （變更後之通知已發送）
 * - CHANGED_NOTIFIED -> NOTIFIED
 *   （變更後已重新通知完成，回到已通知狀態）
 * - CHANGED_NOTIFIED -> CHANGED_NOT_NOTIFIED
 *   （已通知後又再次發生變更，需再次重新通知）
 *
 * 每個狀態皆不允許轉換至自身（狀態未變更時不構成一次「轉換」）。
 */
export const NOTIFICATION_STATUS_TRANSITIONS: Record<NotificationStatus, NotificationStatus[]> = {
  NOT_NOTIFIED: ['NOTIFIED', 'CHANGED_NOT_NOTIFIED'],
  NOTIFIED: ['CHANGED_NOTIFIED', 'CHANGED_NOT_NOTIFIED'],
  CHANGED_NOT_NOTIFIED: ['CHANGED_NOTIFIED'],
  CHANGED_NOTIFIED: ['NOTIFIED', 'CHANGED_NOT_NOTIFIED'],
};

/** 所有合法之通知狀態值 (Requirement 12.3) */
export const VALID_NOTIFICATION_STATUSES: readonly NotificationStatus[] = [
  'NOTIFIED',
  'NOT_NOTIFIED',
  'CHANGED_NOTIFIED',
  'CHANGED_NOT_NOTIFIED',
] as const;

/**
 * 檢查傳入值是否為合法之通知狀態值。
 *
 * @param value 任意值
 * @returns 若 value 為四個合法狀態字串之一則回傳 true，否則回傳 false
 */
export function isValidNotificationStatus(value: unknown): value is NotificationStatus {
  return (
    typeof value === 'string' && (VALID_NOTIFICATION_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * 檢查通知狀態轉換是否合法（符合預定義之狀態機規則）。
 *
 * @param from 轉換前狀態
 * @param to 轉換後狀態
 * @returns 若此轉換合法則回傳 true，否則回傳 false
 */
export function isValidStatusTransition(from: NotificationStatus, to: NotificationStatus): boolean {
  return NOTIFICATION_STATUS_TRANSITIONS[from].includes(to);
}
