import type { NotificationType, NotificationStatus } from '@/types/notification';
import type { SelectOption } from '@/types/common';

export const NOTIFICATION_TYPE_MAP: Record<NotificationType, string> = {
  SCHEDULE_REMINDER: '排班提醒',
  CUSTOMER_NOTIFY: '客戶通知',
  EMPLOYEE_DISPATCH: '員工指派通知',
  CHANGE_APPROVAL: '異動核准通知',
  APPROVAL_RESULT: '核准結果通知',
};

export const NOTIFICATION_STATUS_MAP: Record<NotificationStatus, { label: string; color: string }> =
  {
    NOTIFIED: { label: '已通知', color: '#52C41A' },
    NOT_NOTIFIED: { label: '未通知', color: '#909399' },
    CHANGED_NOTIFIED: { label: '有異動已通知', color: '#1B5E9C' },
    CHANGED_NOT_NOTIFIED: { label: '有異動未通知', color: '#F5222D' },
  };

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

export const isUnreadNotification = (status: NotificationStatus): boolean =>
  UNREAD_NOTIFICATION_STATUSES.includes(status);
