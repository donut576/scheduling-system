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
  WarningOutlined,
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
 * 提供今日排班概要、待審核項目與近期發送通知紀錄：
 * - 今日排班概要：統計今日任務數，點擊警示/已覆蓋標籤可直接開啟彈窗通知查看詳細違規與特許原因
 * - 待審核項目：即時顯示待主管審批之變更與特許申請
 * - 近期發送通知紀錄：呈現今日發送給客戶與員工之郵件通知日誌
 */
const DashboardPage: FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const today = getToday();

  // 警示 / 已覆蓋彈窗狀態
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'violated' | 'overridden'>('violated');

  // 今日排班概要
  const { data: scheduleData, isLoading: scheduleLoading } = useScheduleData({
    dimension: 'customer',
    startDate: today,
    endDate: today,
  });

  const todayEvents = useMemo(() => scheduleData?.events ?? [], [scheduleData]);

  const violatedEvents = useMemo(
    () => todayEvents.filter((e) => e.alertStatus === 'VIOLATED'),
    [todayEvents],
  );
  const overriddenEvents = useMemo(
    () => todayEvents.filter((e) => e.alertStatus === 'OVERRIDDEN'),
    [todayEvents],
  );

  const todaySummary = useMemo(() => {
    const total = todayEvents.length;
    const violated = violatedEvents.length;
    const overridden = overriddenEvents.length;
    return { total, violated, overridden, clean: total - violated - overridden };
  }, [todayEvents, violatedEvents.length, overriddenEvents.length]);

  // 待審核項目
  const { data: approvalData, isLoading: approvalLoading } = useApprovalList({
    page: 1,
    pageSize: 5,
    status: 'PENDING',
  });
  const pendingApprovals = approvalData?.list ?? [];

  // 近期發送通知紀錄
  const { data: notificationData, isLoading: notificationLoading } = useNotificationList({
    page: 1,
    pageSize: 5,
  });
  const recentNotifications = useMemo<Notification[]>(
    () => notificationData?.list ?? [],
    [notificationData],
  );

  // 點擊警示 Tag 處理
  const handleWarningTagClick = () => {
    if (violatedEvents.length === 0) {
      message.info('今日目前無違規警示項目');
      return;
    }
    setModalType('violated');
    setAlertModalOpen(true);
  };

  // 點擊已覆蓋 Tag 處理
  const handleOverriddenTagClick = () => {
    if (overriddenEvents.length === 0) {
      message.info('今日目前無特許覆蓋項目');
      return;
    }
    setModalType('overridden');
    setAlertModalOpen(true);
  };

  const currentModalEvents = modalType === 'violated' ? violatedEvents : overriddenEvents;

  return (
    <div className="dashboard-page" data-testid="dashboard-page">
      <Title level={4} style={{ marginBottom: 16 }}>
        {t('menu.dashboard')}
      </Title>

      <Row gutter={[16, 16]}>
        {/* 今日排班概要 */}
        <Col xs={24} md={12}>
          <Card
            title={
              <Space>
                <CalendarOutlined />
                {t('dashboard.todaySchedule')}
              </Space>
            }
            loading={scheduleLoading}
            data-testid="today-schedule-card"
            extra={
              <Button type="link" onClick={() => navigate('/schedule')}>
                {t('dashboard.viewSchedule')}
              </Button>
            }
          >
            <Statistic title={t('dashboard.todayTaskCount')} value={todaySummary.total} />
            <Space style={{ marginTop: 12 }} wrap size={8}>
              <Tag color="success">
                {t('dashboard.clean')} {todaySummary.clean}
              </Tag>
              <Tag
                color="error"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={handleWarningTagClick}
                data-testid="warning-tag"
              >
                {t('dashboard.warning')} {todaySummary.violated} 🔔
              </Tag>
              <Tag
                color="warning"
                style={{ cursor: 'pointer', userSelect: 'none' }}
                onClick={handleOverriddenTagClick}
                data-testid="overridden-tag"
              >
                {t('dashboard.overridden')} {todaySummary.overridden} 🔔
              </Tag>
            </Space>
          </Card>
        </Col>

        {/* 待審核項目 */}
        <Col xs={24} md={12}>
          <Card
            title={
              <Space>
                <AuditOutlined />
                {t('dashboard.pendingApprovals')}
              </Space>
            }
            loading={approvalLoading}
            data-testid="pending-approval-card"
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
                style={{ marginTop: 12 }}
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
                    <List.Item key={item.id}>
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
      </Row>

      {/* 近期發送通知紀錄 */}
      <Card
        title={
          <Space>
            <BellOutlined />
            <span>近期通知發送紀錄</span>
          </Space>
        }
        loading={notificationLoading}
        style={{ marginTop: 16 }}
        extra={
          <Button type="link" onClick={() => navigate('/notification')}>
            通知管理設定
          </Button>
        }
      >
        {recentNotifications.length === 0 ? (
          <Empty description="目前無發送紀錄" />
        ) : (
          <List
            size="small"
            dataSource={recentNotifications}
            renderItem={(item: Notification) => {
              const statusConfig = NOTIFICATION_STATUS_MAP[item.status];
              return (
                <List.Item key={item.id}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                    <Space size={12}>
                      <Tag color="blue">{NOTIFICATION_TYPE_MAP[item.type] || item.type}</Tag>
                      <Text strong>{item.subject}</Text>
                      <Text type="secondary">收件人：{item.recipientName}</Text>
                    </Space>
                    <Space size={12}>
                      <Tag color={statusConfig?.color}>{statusConfig?.label || item.status}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatDateTime(item.createdAt, 'YYYY-MM-DD HH:mm')}
                      </Text>
                    </Space>
                  </Space>
                </List.Item>
              );
            }}
          />
        )}
      </Card>

      {/* 警示 / 已覆蓋詳細通知彈窗 */}
      <Modal
        title={
          <Space>
            {modalType === 'violated' ? (
              <>
                <WarningOutlined style={{ color: '#ff4d4f' }} />
                <span>今日排班違規警示通知（共 {violatedEvents.length} 筆）</span>
              </>
            ) : (
              <>
                <SafetyCertificateOutlined style={{ color: '#faad14' }} />
                <span>今日排班特許覆蓋通知（共 {overriddenEvents.length} 筆）</span>
              </>
            )}
          </Space>
        }
        open={alertModalOpen}
        onCancel={() => setAlertModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setAlertModalOpen(false)}>
            關閉
          </Button>,
          <Button
            key="viewSchedule"
            type="primary"
            onClick={() => {
              setAlertModalOpen(false);
              navigate('/schedule');
            }}
          >
            前往班表總覽處理
          </Button>,
        ]}
        width={650}
      >
        <List
          dataSource={currentModalEvents}
          renderItem={(event: ScheduleEvent) => {
            const assigneesText =
              event.extendedProps?.assignees?.map((a) => a.employeeName).join('、') || '未指派';
            const reasonText =
              modalType === 'violated'
                ? event.extendedProps?.violationReason ||
                  '排班規則檢核異常（如日工時超限或連續排班）'
                : event.extendedProps?.overrideReason || '主管特許覆蓋指派';

            return (
              <List.Item key={event.id} style={{ padding: '12px 0' }}>
                <div style={{ width: '100%' }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
                  >
                    <Text strong style={{ fontSize: 14 }}>
                      {event.groupName} - {event.branchName}
                    </Text>
                    <Tag color={modalType === 'violated' ? 'error' : 'warning'}>
                      {modalType === 'violated' ? '違規警示' : '已特許覆蓋'}
                    </Tag>
                  </div>
                  <div style={{ color: '#595959', fontSize: 13, marginBottom: 4 }}>
                    負責員工：<Text style={{ color: '#1677ff' }}>{assigneesText}</Text>
                    {' ｜ '}
                    排班時間：{event.start.split('T')[1]?.slice(0, 5)} ~{' '}
                    {event.end.split('T')[1]?.slice(0, 5)}
                  </div>
                  <div
                    style={{
                      background: modalType === 'violated' ? '#fff2f0' : '#fffbe6',
                      border: `1px solid ${modalType === 'violated' ? '#ffccc7' : '#ffe58f'}`,
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 12,
                      color: modalType === 'violated' ? '#cf1322' : '#d48806',
                    }}
                  >
                    {modalType === 'violated' ? '⚠️ 警示原因：' : '🛡️ 覆蓋備註：'}
                    {reasonText}
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
