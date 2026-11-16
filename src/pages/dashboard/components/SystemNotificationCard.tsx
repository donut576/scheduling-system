/**
 * 主任「系統通知」卡片：目前只有「證照即將到期」（審核結果通知已移除）。
 * 第四種列表：到期日塊 + 兩行內容；未讀＝左側藍點；時間在右上；
 * 頂部摘要列顯示件數，7 天內到期用紅字提醒。
 */
import React, { useMemo, useState } from 'react';
import { Button, Card, Empty, Space } from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { designTokens } from '@/styles/tokens';
import {
  useNotificationList,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '@/queries/useNotificationQueries';
import { useUserStore } from '@/stores/useUserStore';
import { isNotificationUnread } from '@/constants/notificationTypes';
import { formatNotifyTime } from '@/utils/notificationTime';
import type { DashboardNotification, LicenseExpiryPayload } from '../dashboardTypes';
import {
  CatPill,
  DateBlock,
  DetailModal,
  DetailSection,
  IconBlock,
  InfoTile,
  TimeText,
  UnreadCount,
  UnreadSlot,
} from '../shared';
import { CANCEL_COLOR } from '../sharedUtils';

const PRIMARY = designTokens.colors.primary;
/** 幾天內到期算「緊急」（紅字） */
export const URGENT_DAYS = 7;

const licenseOf = (n: DashboardNotification): LicenseExpiryPayload | null =>
  n.payload?.kind === 'LICENSE_EXPIRY' ? (n.payload as LicenseExpiryPayload) : null;

const SystemNotificationModal: React.FC<{
  item: DashboardNotification;
  onClose: () => void;
}> = ({ item, onClose }) => {
  const l = licenseOf(item);
  if (l) {
    const urgent = l.daysLeft <= URGENT_DAYS;
    const accent = urgent ? CANCEL_COLOR : PRIMARY;
    return (
      <DetailModal
        accent={accent}
        kicker={
          <CatPill icon={<SafetyCertificateOutlined />} color={accent}>
            證照即將到期
          </CatPill>
        }
        title={`${l.employeeName}\u3000${l.license}`}
        tiles={
          <>
            <InfoTile
              icon={<CalendarOutlined />}
              label="到期日"
              value={l.expiryDate.replace(/-/g, '/')}
              accent={accent}
            />
            <InfoTile
              icon={<ClockCircleOutlined />}
              label="剩餘天數"
              value={`${l.daysLeft} 天`}
              accent={accent}
            />
          </>
        }
        onClose={onClose}
      />
    );
  }
  return (
    <DetailModal accent={PRIMARY} kicker="系統通知" title={item.subject} onClose={onClose}>
      <DetailSection icon={<FileTextOutlined />} label="內容">
        {item.content}
      </DetailSection>
    </DetailModal>
  );
};

const NotificationRow: React.FC<{ n: DashboardNotification; onOpen: () => void }> = ({
  n,
  onOpen,
}) => {
  const l = licenseOf(n);
  const urgent = l ? l.daysLeft <= URGENT_DAYS : false;
  const color = urgent ? CANCEL_COLOR : PRIMARY;
  return (
    <div
      className="dash-item"
      role="button"
      tabIndex={0}
      data-testid="system-notification-row"
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <UnreadSlot unread={isNotificationUnread(n)} />
      {l ? (
        <DateBlock date={l.expiryDate} color={color} caption="到期" />
      ) : (
        <IconBlock icon={<NotificationOutlined />} color={PRIMARY} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="dash-d1">{l ? `${l.employeeName}\u3000${l.license}` : n.subject}</div>
        {l && (
          <div className="dash-d2">
            <CatPill icon={<SafetyCertificateOutlined />} color={color}>
              剩 {l.daysLeft} 天
            </CatPill>
          </div>
        )}
      </div>
      <span style={{ alignSelf: 'flex-start' }}>
        <TimeText>{formatNotifyTime(n.createdAt)}</TimeText>
      </span>
    </div>
  );
};

const SystemNotificationCard: React.FC = () => {
  const user = useUserStore((s) => s.user);
  const { data } = useNotificationList({
    page: 1,
    pageSize: 50,
    channel: 'IN_APP',
    recipientId: user?.id,
  });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [selected, setSelected] = useState<DashboardNotification | null>(null);

  const items = useMemo(
    () =>
      ((data?.list ?? []) as DashboardNotification[])
        .filter((n) => n.type === 'LICENSE_EXPIRY')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data],
  );
  const unread = items.filter(isNotificationUnread).length;
  const urgentCount = items.filter((n) => (licenseOf(n)?.daysLeft ?? 999) <= URGENT_DAYS).length;

  const open = (n: DashboardNotification) => {
    setSelected(n);
    if (isNotificationUnread(n)) markRead.mutate(n.id);
  };

  return (
    <Card
      data-testid="system-notification-card"
      title={
        <Space size={8}>
          <NotificationOutlined />
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            系統通知
            <UnreadCount count={unread} />
          </span>
        </Space>
      }
      extra={
        unread > 0 && (
          <Button type="link" size="small" onClick={() => markAll.mutate()}>
            全部標為已讀
          </Button>
        )
      }
    >
      {items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="沒有系統通知" />
      ) : (
        <>
          <div className="dash-summary" data-testid="system-notification-summary">
            證照即將到期 {items.length} 位
            {urgentCount > 0 && (
              <>
                {' · '}
                {URGENT_DAYS} 天內 <span style={{ color: CANCEL_COLOR }}>{urgentCount} 位</span>
              </>
            )}
          </div>
          {items.map((n) => (
            <NotificationRow key={n.id} n={n} onOpen={() => open(n)} />
          ))}
        </>
      )}
      {selected && <SystemNotificationModal item={selected} onClose={() => setSelected(null)} />}
    </Card>
  );
};

export default SystemNotificationCard;
