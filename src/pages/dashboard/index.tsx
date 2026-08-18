import React, { useState, useMemo } from 'react';
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
import { APPROVAL_TYPE_MAP } from '@/constants/approvalTypes';
import { NOTIFICATION_TYPE_MAP, NOTIFICATION_STATUS_MAP } from '@/constants/notificationTypes';
import { getToday, formatDateTime } from '@/utils/date';
import type { Notification } from '@/types/notification';
import type { ScheduleEvent } from '@/types/schedule';

const { Text, Title } = Typography;

/**
 * Dashboard 首頁
 *
 * 頂部提供三大主要資訊卡片並排呈現：
 * 1. 今日排班概要：任務數統計，僅顯示「正常」與「已覆蓋」（問題排班於建立/核准時已處理，上線班表僅正常或特許覆蓋）
 * 2. 待審核項目：即時顯示待主管審批之變更與特許申請清單
 * 3. 近期通知發送紀錄：呈現今日發送給客戶與員工之郵件通知日誌
 */
const DashboardPage: FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const today = getToday();

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

  const overriddenEvents = useMemo(
    () => todayEvents.filter((e) => e.alertStatus === 'OVERRIDDEN'),
    [todayEvents],
  );

  const todaySummary = useMemo(() => {
    const total = todayEvents.length;
    const overridden = overriddenEvents.length;
    const clean = total - overridden;
    return { total, clean, overridden };
  }, [todayEvents.length, overriddenEvents.length]);

  // 2. 待審核項目
  const { data: approvalData, isLoading: approvalLoading } = useApprovalList({
    page: 1,
    pageSize: 5,
    status: 'PENDING',
  });
  const pendingApprovals = approvalData?.list ?? [];

  // 3. 近期發送通知紀錄（近 7 日）
  const { data: notificationData, isLoading: notificationLoading } = useNotificationList({
    page: 1,
    pageSize: 6,
  });
  const recentNotifications = useMemo<Notification[]>(
    () => notificationData?.list ?? [],
    [notificationData],
  );

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
      <Title level={4} style={{ marginBottom: 16 }}>
        {t('menu.dashboard')}
      </Title>

      {/* 三大卡片並排（xs=24, md=24, lg=8） */}
      <Row gutter={[16, 16]}>
        {/* 卡片 1：今日排班概要 */}
        <Col xs={24} md={24} lg={8}>
          <Card
            title={
              <Space>
                <CalendarOutlined />
                {t('dashboard.todaySchedule')}
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
            <Statistic title={t('dashboard.todayTaskCount')} value={todaySummary.total} />
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
                {t('dashboard.overridden')} {todaySummary.overridden} 🔔
              </Tag>
            </Space>
          </Card>
        </Col>

        {/* 卡片 2：待審核項目 */}
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
                {t('dashboard.goApproval')}
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

        {/* 卡片 3：近期通知發送紀錄 */}
        <Col xs={24} md={24} lg={8}>
          <Card
            title={
              <Space>
                <BellOutlined />
                <span>近期通知發送紀錄</span>
              </Space>
            }
            loading={notificationLoading}
            data-testid="recent-notifications-card"
            style={{ height: '100%' }}
            extra={
              <Button type="link" onClick={() => navigate('/notification')}>
                通知設定
              </Button>
            }
          >
            <Statistic
              title="近 7 日發送總則數"
              value={notificationData?.total ?? recentNotifications.length}
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
                            <Text ellipsis strong style={{ fontSize: 13 }}>
                              {item.recipientName}
                            </Text>
                          </Space>
                          <Tag color={statusConfig?.color} style={{ margin: 0, fontSize: 11 }}>
                            {statusConfig?.label || item.status}
                          </Tag>
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
              <div>
                <Text type="secondary">發送狀態：</Text>
                <Tag color={NOTIFICATION_STATUS_MAP[selectedNotification.status]?.color}>
                  {NOTIFICATION_STATUS_MAP[selectedNotification.status]?.label ||
                    selectedNotification.status}
                </Tag>
              </div>
              <div>
                <Text type="secondary">收件對象：</Text>
                <Text strong>{selectedNotification.recipientName}</Text>
              </div>
              <div>
                <Text type="secondary">發送時間：</Text>
                <Text>{formatDateTime(selectedNotification.createdAt, 'YYYY-MM-DD HH:mm:ss')}</Text>
              </div>
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>
                ✉️ 郵件主旨
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
                📄 郵件完整內文預覽
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
                    🛡️ 覆蓋備註：{reasonText}
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
