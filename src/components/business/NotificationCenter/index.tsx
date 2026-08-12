import React, { useMemo } from 'react';
import { List, Tag, Typography, Empty, Spin, Badge } from 'antd';
import { useNotificationList } from '@/queries/useNotificationQueries';
import {
  NOTIFICATION_TYPE_MAP,
  NOTIFICATION_STATUS_MAP,
  isUnreadNotification,
} from '@/constants/notificationTypes';
import { formatDateTime } from '@/utils/date';

const { Text } = Typography;

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
 * 未讀判定：由於 Notification 型別無明確已讀/未讀欄位，本元件依通知狀態
 * 判斷 - NOT_NOTIFIED 與 CHANGED_NOT_NOTIFIED 視為「未讀」（尚待處理/發送），
 * NOTIFIED 與 CHANGED_NOTIFIED 視為「已讀」（已完成通知）。
 *
 * Validates: Requirements 12.6
 */
const NotificationCenter: React.FC<NotificationCenterProps> = ({ limit = 10 }) => {
  const { data, isLoading } = useNotificationList({ page: 1, pageSize: limit });

  const notifications = useMemo(() => data?.list ?? [], [data]);

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
        <Empty description="尚無通知" />
      </div>
    );
  }

  return (
    <div
      style={{ width: 360, maxHeight: 480, overflowY: 'auto' }}
      role="region"
      aria-label="通知中心"
      data-testid="notification-center"
    >
      <List
        dataSource={notifications}
        itemLayout="vertical"
        size="small"
        renderItem={(notification) => {
          const unread = isUnreadNotification(notification.status);
          const statusConfig = NOTIFICATION_STATUS_MAP[notification.status];

          return (
            <List.Item
              key={notification.id}
              data-testid={`notification-item-${notification.id}`}
              style={{
                backgroundColor: unread ? '#f0f7ff' : undefined,
                paddingInline: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Tag color="default">{NOTIFICATION_TYPE_MAP[notification.type]}</Tag>
                  {unread && (
                    <Badge status="processing" text="未讀" data-testid="unread-indicator" />
                  )}
                </div>
                <Text strong>{notification.subject}</Text>
                <Text type="secondary">收件者：{notification.recipientName}</Text>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
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
  const { data } = useNotificationList({ page: 1, pageSize: limit });
  return useMemo(
    () => (data?.list ?? []).filter((n) => isUnreadNotification(n.status)).length,
    [data],
  );
};

export default NotificationCenter;
