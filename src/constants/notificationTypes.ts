/**
 * 通知類型與狀態相關常數
 *
 * 提供通知類型/狀態之顯示文字與顏色對照表、下拉選單選項，
 * 以及判斷通知是否為「未讀」之輔助函式。
 */
import type { NotificationType, NotificationStatus } from '@/types/notification';
import type { SelectOption } from '@/types/common';

/** 通知類型對應顯示文字 */
export const NOTIFICATION_TYPE_MAP: Record<NotificationType, string> = {
  SCHEDULE_REMINDER: '排班提醒',
  CUSTOMER_NOTIFY: '客戶通知',
  EMPLOYEE_DISPATCH: '員工指派通知',
  CHANGE_APPROVAL: '異動核准通知',
  APPROVAL_RESULT: '核准結果通知',
};

/** 通知狀態對應顯示文字與顏色 */
export const NOTIFICATION_STATUS_MAP: Record<NotificationStatus, { label: string; color: string }> =
  {
    NOTIFIED: { label: '已通知', color: '#52C41A' },
    NOT_NOTIFIED: { label: '未通知', color: '#909399' },
    CHANGED_NOTIFIED: { label: '有異動已通知', color: '#1B5E9C' },
    CHANGED_NOT_NOTIFIED: { label: '有異動未通知', color: '#F5222D' },
  };

/** 通知類型下拉選單選項（由 NOTIFICATION_TYPE_MAP 轉換而來） */
export const NOTIFICATION_TYPE_OPTIONS: SelectOption[] = Object.entries(NOTIFICATION_TYPE_MAP).map(
  ([value, label]) => ({ label, value }),
);

/**
 * Notification statuses that represent an "unread" / not-yet-acted-upon notification.
 *
 * The Notification type has no explicit read/unread flag (see types/notification.ts).
 * Per Requirement 12.6 (應用程式內通知中心介面) and 12.3 (通知狀態追蹤：已通知/未通知/
 * 已變更+已通知/已變更+未通知), we treat NOT_NOTIFIED and CHANGED_NOT_NOTIFIED as "unread"
 * because these represent notifications that have not yet been sent/acted upon and require
 * attention. NOTIFIED and CHANGED_NOTIFIED are treated as "read" since the recipient has
 * already been notified.
 */
export const UNREAD_NOTIFICATION_STATUSES: NotificationStatus[] = [
  'NOT_NOTIFIED',
  'CHANGED_NOT_NOTIFIED',
];

/** 判斷指定通知狀態是否為「未讀」 */
export const isUnreadNotification = (status: NotificationStatus): boolean =>
  UNREAD_NOTIFICATION_STATUSES.includes(status);
