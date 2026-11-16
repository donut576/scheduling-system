/**
 * NotificationCenter 元件
 *
 * 業務用途：於應用程式頁首鈴鐺圖標點擊後顯示的通知中心面板，列出最近的
 * 系統通知（排班提醒、客戶通知、員工派工、異動審核、審核結果等），並標記
 * 尚未完成通知/待處理之項目。
 */
import React, { useMemo } from 'react';
import { List, Tag, Typography, Empty, Spin, Badge, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  useNotificationList,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/queries/useNotificationQueries';
import { NOTIFICATION_STATUS_MAP, isNotificationUnread } from '@/constants/notificationTypes';
import { formatDateTime } from '@/utils/date';
import { useUserStore } from '@/stores/useUserStore';
import type { Notification } from '@/types/notification';

const { Text } = Typography;

/** 通知類型對應之 i18n 翻譯鍵值 */
const NOTIFICATION_TYPE_KEYS = {
  SCHEDULE_REMINDER: 'notification.types.scheduleReminder',
  CUSTOMER_NOTIFY: 'notification.types.customerNotify',
  EMPLOYEE_DISPATCH: 'notification.types.employeeDispatch',
  CHANGE_APPROVAL: 'notification.types.changeApproval',
  APPROVAL_RESULT: 'notification.types.approvalResult',
  TASK_CREATED: 'notification.types.taskCreated',
  TASK_UPDATED: 'notification.types.taskUpdated',
  TASK_CANCELED: 'notification.types.taskCanceled',
  LICENSE_EXPIRY: 'notification.types.licenseExpiry',
} as const;

const NOTIFICATION_STATUS_KEYS = {
  NOTIFIED: 'notification.status.notified',
  NOT_NOTIFIED: 'notification.status.notNotified',
  CHANGED_NOTIFIED: 'notification.status.changedNotified',
  CHANGED_NOT_NOTIFIED: 'notification.status.changedNotNotified',
} as const;

/**
 * 取得「我的」通知：只列出寄給我的站內通知；
 * 證照到期通知只給主任等管理角色，一般員工不會看到。
 */
const useMyNotifications = (limit: number): { list: Notification[]; isLoading: boolean } => {
  const user = useUserStore((state) => state.user);
  const { data, isLoading } = useNotificationList({
    page: 1,
    pageSize: limit,
    recipientId: user?.id,
    channel: 'IN_APP',
  });
  const list = useMemo(
    () =>
      (data?.list ?? []).filter((n) => !(user?.role === 'STAFF' && n.type === 'LICENSE_EXPIRY')),
    [data, user?.role],
  );
  return { list, isLoading };
};

/** NotificationCenterProps - limit：顯示之最近通知筆數上限 */
export interface NotificationCenterProps {
  /** Maximum number of recent notifications to display, defaults to 10 */
  limit?: number;
}

/**
 * NotificationCenter - 應用程式內通知中心介面
 *
 * 由 AppHeader 鈴鐺圖標觸發顯示。顯示最近的通知列表，包含：
 * 類型、收件者、主旨、狀態、時間，並標記未讀通知。
 *
 * 未讀判定：站內通知（任務異動、證照到期）以 isRead 為準，點擊該則通知即標為已讀，
 * 也可按「全部標為已讀」；舊的郵件通知記錄沒有 isRead，沿用狀態判斷 -
 * NOT_NOTIFIED 與 CHANGED_NOT_NOTIFIED 視為「未讀」。
 *
 * Validates: Requirements 12.6
 */
const NotificationCenter: React.FC<NotificationCenterProps> = ({ limit = 10 }) => {
  const { t } = useTranslation();
  const { list, isLoading } = useMyNotifications(limit);

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = list;
  const unreadCount = useMemo(
    () => notifications.filter((n) => isNotificationUnread(n)).length,
    [notifications],
  );

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }} data-testid="notification-center-loading">
        <Spin size="small" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div style={{ padding: 16 }} data-testid="notification-center">
        <Empty description={t('notification.noNotifications')} />
      </div>
    );
  }

  return (
    <div
      style={{ width: 360, maxHeight: 480, overflowY: 'auto' }}
      role="region"
      aria-label={t('notification.center')}
      data-testid="notification-center"
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <Text strong>
          {t('notification.center')}
          {unreadCount > 0 ? `（${unreadCount}）` : ''}
        </Text>
        <Button
          type="link"
          size="small"
          disabled={unreadCount === 0}
          loading={markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
          data-testid="mark-all-read-btn"
        >
          {t('notification.markAllRead')}
        </Button>
      </div>
      <List
        dataSource={notifications}
        itemLayout="vertical"
        size="small"
        renderItem={(notification) => {
          const unread = isNotificationUnread(notification);
          const statusConfig = NOTIFICATION_STATUS_MAP[notification.status];

          return (
            <List.Item
              key={notification.id}
              data-testid={`notification-item-${notification.id}`}
              onClick={() => {
                if (unread && notification.isRead !== undefined) markRead.mutate(notification.id);
              }}
              style={{
                backgroundColor: unread ? '#f0f7ff' : undefined,
                paddingInline: 12,
                cursor: unread && notification.isRead !== undefined ? 'pointer' : undefined,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Tag color="default">{t(NOTIFICATION_TYPE_KEYS[notification.type])}</Tag>
                  {unread && (
                    <Badge
                      status="processing"
                      text={t('notification.unread')}
                      data-testid="unread-indicator"
                    />
                  )}
                </div>
                <Text strong>{notification.subject}</Text>
                <Text type="secondary">
                  {t('notification.recipient')}：{notification.recipientName}
                </Text>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  {notification.isRead === undefined ? (
                    <Tag color={statusConfig.color}>
                      {t(NOTIFICATION_STATUS_KEYS[notification.status])}
                    </Tag>
                  ) : (
                    <span />
                  )}
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {formatDateTime(notification.createdAt, 'YYYY-MM-DD HH:mm')}
                  </Text>
                </div>
              </div>
            </List.Item>
          );
        }}
      />
    </div>
  );
};

/**
 * Hook for computing the unread notification count for badge display.
 * Fetches the most recent page of notifications and counts unread ones.
 *
 * Validates: Requirements 12.6
 */
export const useUnreadNotificationCount = (limit = 50): number => {
  const { list } = useMyNotifications(limit);
  return useMemo(() => list.filter((n) => isNotificationUnread(n)).length, [list]);
};

export default NotificationCenter;
