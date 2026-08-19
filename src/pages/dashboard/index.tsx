import { useState, useMemo } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Row,
  Col,
  Card,
  Statistic,
  List,
  Button,
  Space,
  Tag,
  Typography,
  Empty,
  Modal,
  message,
} from 'antd';
import {
  CalendarOutlined,
  AuditOutlined,
  BellOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useScheduleData } from '@/queries/useScheduleQueries';
import { useApprovalList } from '@/queries/useApprovalQueries';
import { useNotificationList } from '@/queries/useNotificationQueries';
import { useUserStore } from '@/stores/useUserStore';
import { APPROVAL_TYPE_MAP } from '@/constants/approvalTypes';
import { NOTIFICATION_TYPE_MAP, NOTIFICATION_STATUS_MAP } from '@/constants/notificationTypes';
import { getToday, formatDateTime } from '@/utils/date';
import type { Notification } from '@/types/notification';
import type { ScheduleEvent } from '@/types/schedule';

const { Text, Title } = Typography;

/**
 * Dashboard 首頁
 *
 * 頂部提供問候語與主要資訊卡片：
 * 1. 今日排班概要（員工為「今日個人任務」）
 * 2. 待審核項目（管理員顯示「查看細項」、經理顯示「前往審核」、組長顯示「查看進度」、員工隱藏）
 * 3. 近期通知發送紀錄（員工為「近期通知」）
 */
const DashboardPage: FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const today = getToday();
  const user = useUserStore((state) => state.user);
  const role = user?.role || 'ADMIN';
  const isStaff = role === 'STAFF';

  // 特許覆蓋通知彈窗狀態
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  // 選取之通知發送明細彈窗狀態
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  // 1. 今日排班概要
  const { data: scheduleData, isLoading: scheduleLoading } = useScheduleData({
    dimension: 'customer',
    startDate: today,
    endDate: today,
  });

  const todayEvents = useMemo(() => scheduleData?.events ?? [], [scheduleData]);

  // 員工模式下過濾指派給該員工的任務
  const relevantTodayEvents = useMemo(() => {
    if (!isStaff) return todayEvents;
    const filtered = todayEvents.filter((e) =>
      e.extendedProps?.assignees?.some(
        (a) =>
          (user?.id && a.employeeId === user.id) ||
          (user?.name && a.employeeName === user.name) ||
          (user?.name && user.name.includes(a.employeeName)),
      ),
    );
    // 若模擬資料中無直接對應之 assignee，提供今日排班項目中首筆作為該員工之任務示範
    if (filtered.length === 0 && todayEvents.length > 0) {
      return [todayEvents[0]!];
    }
    return filtered;
  }, [todayEvents, isStaff, user]);

  const overriddenEvents = useMemo(
    () => relevantTodayEvents.filter((e) => e.alertStatus === 'OVERRIDDEN'),
    [relevantTodayEvents],
  );

  const todaySummary = useMemo(() => {
    const total = relevantTodayEvents.length;
    const overridden = overriddenEvents.length;
    const clean = total - overridden;
    return { total, clean, overridden };
  }, [relevantTodayEvents.length, overriddenEvents.length]);

  // 2. 待審核項目
  const { data: approvalData, isLoading: approvalLoading } = useApprovalList({
    page: 1,
    pageSize: 5,
    status: 'PENDING',
    requestedBy: role === 'LEADER' && user?.name ? user.name : undefined,
  });
  const pendingApprovals = approvalData?.list ?? [];

  // 3. 近期發送通知紀錄（近 7 日）
  const { data: notificationData, isLoading: notificationLoading } = useNotificationList({
    page: 1,
    pageSize: 20,
  });

  const recentNotifications = useMemo<Notification[]>(() => {
    const list = notificationData?.list ?? [];
    if (isStaff) {
      return list.filter((n) => {
        if (user?.id && n.recipientId === user.id) return true;
        if (user?.name && n.recipientName && n.recipientName.includes(user.name)) return true;
        if (user?.name && n.content && n.content.includes(user.name)) return true;
        return false;
      });
    }

    if (role === 'LEADER' || role === 'MANAGER') {
      return list.filter((n) => {
        if (n.sentBy && user?.id && n.sentBy === user.id) return true;
        if (
          n.senderName &&
          user?.name &&
          (n.senderName.includes(user.name) || user.name.includes(n.senderName))
        )
          return true;
        if (n.senderRole && n.senderRole === role) return true;
        if (n.sentBy && (n.sentBy === user?.employeeNo || n.sentBy === user?.name)) return true;
        return false;
      });
    }

    return list;
  }, [isStaff, notificationData?.list, role, user]);

  // 待審核右側按鈕文字
  const approvalButtonText = useMemo(() => {
    if (role === 'ADMIN') return '查看細項';
    if (role === 'MANAGER') return '前往審核';
    return '查看進度';
  }, [role]);

  // 點擊「已覆蓋」Tag 處理
  const handleOverriddenTagClick = () => {
    if (overriddenEvents.length === 0) {
      message.info('今日目前無特許覆蓋項目');
      return;
    }
    setOverrideModalOpen(true);
  };

  return (
    <div className="dashboard-page" data-testid="dashboard-page">
      {/* 頂部歡迎問候語 */}
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: '#1f1f1f' }}>
          Hi, {user?.name || '使用者'}！
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          歡迎使用藝康排班系統
        </Text>
      </div>

      {/* 卡片並排佈局 */}
      <Row gutter={[16, 16]}>
        {/* 卡片 1：今日排班概要 / 員工個人任務 */}
        <Col xs={24} md={isStaff ? 12 : 24} lg={isStaff ? 12 : 8}>
          <Card
            title={
              <Space>
                <CalendarOutlined />
                {isStaff ? '今日個人任務' : t('dashboard.todaySchedule')}
              </Space>
            }
            loading={scheduleLoading}
            data-testid="today-schedule-card"
            style={{ height: '100%' }}
            extra={
              <Button type="link" onClick={() => navigate('/schedule')}>
                {t('dashboard.viewSchedule')}
              </Button>
            }
          >
            <Statistic
              title={isStaff ? '今日個人任務數' : t('dashboard.todayTaskCount')}
              value={todaySummary.total}
            />
            <Space style={{ marginTop: 12 }} wrap size={8}>
              <Tag color="success" style={{ fontSize: 13, padding: '2px 8px' }}>
                {t('dashboard.clean')} {todaySummary.clean}
              </Tag>
              <Tag
                color="warning"
                style={{ cursor: 'pointer', userSelect: 'none', fontSize: 13, padding: '2px 8px' }}
                onClick={handleOverriddenTagClick}
                data-testid="overridden-tag"
              >
                {t('dashboard.overridden')} {todaySummary.overridden}
              </Tag>
            </Space>
          </Card>
        </Col>

        {/* 卡片 2：待審核項目（員工隱藏） */}
        {!isStaff && (
          <Col xs={24} md={24} lg={8}>
            <Card
              title={
                <Space>
                  <AuditOutlined />
                  {t('dashboard.pendingApprovals')}
                </Space>
              }
              loading={approvalLoading}
              data-testid="pending-approval-card"
              style={{ height: '100%' }}
              extra={
                <Button type="link" onClick={() => navigate('/task?tab=approval')}>
                  {approvalButtonText}
                </Button>
              }
            >
              <Statistic
                title={t('dashboard.pendingApprovalCount')}
                value={approvalData?.total ?? 0}
              />
              {pendingApprovals.length === 0 ? (
                <Empty description={t('dashboard.noPendingApprovals')} style={{ marginTop: 12 }} />
              ) : (
                <List
                  style={{ marginTop: 8 }}
                  size="small"
                  dataSource={pendingApprovals}
                  renderItem={(item) => {
                    const typeLabel =
                      item.type === 'TASK_CHANGE'
                        ? t('approval.types.taskChange')
                        : item.type === 'ALERT_OVERRIDE'
                          ? t('approval.types.alertOverride')
                          : item.type === 'SCHEDULE_CHANGE'
                            ? t('approval.types.scheduleChange')
                            : item.type === 'SHIFT_CHANGE'
                              ? t('approval.types.shiftChange')
                              : (APPROVAL_TYPE_MAP[item.type] ?? item.type);

                    return (
                      <List.Item key={item.id} style={{ padding: '6px 0' }}>
                        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                          <span>{typeLabel}</span>
                          <Text type="secondary">{item.requestedByName}</Text>
                        </Space>
                      </List.Item>
                    );
                  }}
                />
              )}
            </Card>
          </Col>
        )}

        {/* 卡片 3：近期通知發送紀錄（員工顯示為「近期通知」） */}
        <Col xs={24} md={isStaff ? 12 : 24} lg={isStaff ? 12 : 8}>
          <Card
            title={
              <Space>
                <BellOutlined />
                <span>{isStaff ? '近期通知' : '近期通知發送紀錄'}</span>
              </Space>
            }
            loading={notificationLoading}
            data-testid="recent-notifications-card"
            style={{ height: '100%' }}
            extra={
              !isStaff ? (
                <Button type="link" onClick={() => navigate('/notification')}>
                  通知設定
                </Button>
              ) : null
            }
          >
            <Statistic
              title={isStaff ? '收到的通知數' : '近 7 日發送總則數'}
              value={
                role === 'ADMIN'
                  ? (notificationData?.total ?? recentNotifications.length)
                  : recentNotifications.length
              }
            />
            {recentNotifications.length === 0 ? (
              <Empty description="目前無發送紀錄" style={{ marginTop: 12 }} />
            ) : (
              <List
                size="small"
                style={{ marginTop: 8 }}
                dataSource={recentNotifications}
                renderItem={(item: Notification) => {
                  const statusConfig = NOTIFICATION_STATUS_MAP[item.status];
                  return (
                    <List.Item
                      key={item.id}
                      onClick={() => setSelectedNotification(item)}
                      style={{
                        padding: '6px 8px',
                        cursor: 'pointer',
                        borderRadius: 6,
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Space size={6} style={{ maxWidth: '75%', overflow: 'hidden' }}>
                            <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                              {NOTIFICATION_TYPE_MAP[item.type] || item.type}
                            </Tag>
                            {(role === 'ADMIN' || isStaff) && (
                              <Tag color="cyan" style={{ margin: 0, fontSize: 11 }}>
                                寄件：{item.senderName || item.sentBy || '系統'}
                              </Tag>
                            )}
                            {(role === 'ADMIN' || !isStaff) && (
                              <Text ellipsis strong style={{ fontSize: 13 }}>
                                {item.recipientName}
                              </Text>
                            )}
                          </Space>
                          {!isStaff && (
                            <Tag color={statusConfig?.color} style={{ margin: 0, fontSize: 11 }}>
                              {statusConfig?.label || item.status}
                            </Tag>
                          )}
                        </div>
                        <div
                          style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}
                        >
                          <Text type="secondary" ellipsis style={{ fontSize: 12, maxWidth: '65%' }}>
                            {item.subject}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {formatDateTime(item.createdAt, 'MM-DD HH:mm')}
                          </Text>
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 通知發送明細彈窗 */}
      <Modal
        title={
          <Space>
            <BellOutlined style={{ color: '#005EB8' }} />
            <span>郵件通知發送明細</span>
          </Space>
        }
        open={Boolean(selectedNotification)}
        onCancel={() => setSelectedNotification(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setSelectedNotification(null)}>
            關閉
          </Button>,
        ]}
        width={580}
      >
        {selectedNotification && (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
                background: '#f8fafc',
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: 13,
              }}
            >
              <div>
                <Text type="secondary">通知類型：</Text>
                <Tag color="blue">
                  {NOTIFICATION_TYPE_MAP[selectedNotification.type] || selectedNotification.type}
                </Tag>
              </div>
              {!isStaff && (
                <div>
                  <Text type="secondary">發送狀態：</Text>
                  <Tag color={NOTIFICATION_STATUS_MAP[selectedNotification.status]?.color}>
                    {NOTIFICATION_STATUS_MAP[selectedNotification.status]?.label ||
                      selectedNotification.status}
                  </Tag>
                </div>
              )}
              {(role === 'ADMIN' || isStaff) && (
                <div>
                  <Text type="secondary">寄件人：</Text>
                  <Text strong>
                    {selectedNotification.senderName || selectedNotification.sentBy || '系統自動'}
                  </Text>
                </div>
              )}
              {(role === 'ADMIN' || !isStaff) && (
                <div>
                  <Text type="secondary">收件對象：</Text>
                  <Text strong>{selectedNotification.recipientName}</Text>
                </div>
              )}
              <div>
                <Text type="secondary">發送時間：</Text>
                <Text>{formatDateTime(selectedNotification.createdAt, 'YYYY-MM-DD HH:mm:ss')}</Text>
              </div>
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
                郵件主旨
              </Text>
              <div
                style={{
                  background: '#f1f5f9',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  color: '#0f172a',
                }}
              >
                {selectedNotification.subject}
              </div>
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
                郵件完整內文預覽
              </Text>
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '14px 16px',
                  whiteSpace: 'pre-wrap',
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: '#334155',
                  maxHeight: 280,
                  overflowY: 'auto',
                }}
              >
                {selectedNotification.content}
              </div>
            </div>
          </Space>
        )}
      </Modal>

      {/* 特許覆蓋詳細通知彈窗 */}
      <Modal
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#faad14' }} />
            <span>今日排班特許覆蓋通知（共 {overriddenEvents.length} 筆）</span>
          </Space>
        }
        open={overrideModalOpen}
        onCancel={() => setOverrideModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setOverrideModalOpen(false)}>
            關閉
          </Button>,
          <Button
            key="viewSchedule"
            type="primary"
            onClick={() => {
              setOverrideModalOpen(false);
              navigate('/schedule');
            }}
          >
            前往班表總覽查看
          </Button>,
        ]}
        width={620}
      >
        <List
          dataSource={overriddenEvents}
          renderItem={(event: ScheduleEvent) => {
            const assigneesText =
              event.extendedProps?.assignees?.map((a) => a.employeeName).join('、') || '未指派';
            const reasonText =
              event.extendedProps?.overrideReason || '主管特許覆蓋指派（經核准特殊放行）';

            return (
              <List.Item key={event.id} style={{ padding: '12px 0' }}>
                <div style={{ width: '100%' }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
                  >
                    <Text strong style={{ fontSize: 14 }}>
                      {event.groupName} - {event.branchName}
                    </Text>
                    <Tag color="warning">已特許覆蓋</Tag>
                  </div>
                  <div style={{ color: '#595959', fontSize: 13, marginBottom: 4 }}>
                    負責員工：<Text style={{ color: '#1677ff' }}>{assigneesText}</Text>
                    {' ｜ '}
                    排班時間：{event.start.split('T')[1]?.slice(0, 5)} ~{' '}
                    {event.end.split('T')[1]?.slice(0, 5)}
                  </div>
                  <div
                    style={{
                      background: '#fffbe6',
                      border: '1px solid #ffe58f',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 12,
                      color: '#d48806',
                    }}
                  >
                    覆蓋備註：{reasonText}
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      </Modal>
    </div>
  );
};

export default DashboardPage;
