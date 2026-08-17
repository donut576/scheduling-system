import { useMemo } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Row, Col, Card, Statistic, List, Button, Space, Tag, Typography, Empty } from 'antd';
import { CalendarOutlined, AuditOutlined, AlertOutlined, BellOutlined } from '@ant-design/icons';
import { useScheduleData } from '@/queries/useScheduleQueries';
import { useApprovalList } from '@/queries/useApprovalQueries';
import { useTaskList } from '@/queries/useTaskQueries';
import { useNotificationList } from '@/queries/useNotificationQueries';
import AlertBadge from '@/components/business/AlertBadge';
import { APPROVAL_TYPE_MAP } from '@/constants/approvalTypes';
import {
  NOTIFICATION_TYPE_KEYS,
  NOTIFICATION_STATUS_KEYS,
  NOTIFICATION_STATUS_MAP,
} from '@/constants/notificationTypes';
import { getToday, dayjs, formatDateTime } from '@/utils/date';
import type { Task } from '@/types/task';
import type { Notification } from '@/types/notification';

const { Text, Title } = Typography;

/**
 * Dashboard 首頁
 *
 * 作為登入後之預設首頁，提供四項概要資訊：
 * - 今日排班概要
 * - 待審核項目
 * - 近期警示
 * - 近期發送通知紀錄
 */
const DashboardPage: FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const today = getToday();
  const recentStart = dayjs(today).subtract(7, 'day').format('YYYY-MM-DD');

  // 今日排班概要
  const { data: scheduleData, isLoading: scheduleLoading } = useScheduleData({
    dimension: 'customer',
    startDate: today,
    endDate: today,
  });

  const todayEvents = useMemo(() => scheduleData?.events ?? [], [scheduleData]);
  const todaySummary = useMemo(() => {
    const total = todayEvents.length;
    const violated = todayEvents.filter((e) => e.alertStatus === 'VIOLATED').length;
    const overridden = todayEvents.filter((e) => e.alertStatus === 'OVERRIDDEN').length;
    return { total, violated, overridden, clean: total - violated - overridden };
  }, [todayEvents]);

  // 待審核項目
  const { data: approvalData, isLoading: approvalLoading } = useApprovalList({
    page: 1,
    pageSize: 5,
    status: 'PENDING',
  });
  const pendingApprovals = approvalData?.list ?? [];

  // 近期警示：近 7 日內 alertStatus 為 VIOLATED 或 OVERRIDDEN 之任務
  const { data: recentTaskData, isLoading: taskLoading } = useTaskList({
    page: 1,
    pageSize: 100,
    startDate: recentStart,
    endDate: today,
  });
  const recentAlerts = useMemo<Task[]>(() => {
    const list = recentTaskData?.list ?? [];
    return list
      .filter((t) => t.alertStatus === 'VIOLATED' || t.alertStatus === 'OVERRIDDEN')
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 5);
  }, [recentTaskData]);

  // 近期發送通知紀錄
  const { data: notificationData, isLoading: notificationLoading } = useNotificationList({
    page: 1,
    pageSize: 5,
  });
  const recentNotifications = useMemo<Notification[]>(
    () => notificationData?.list ?? [],
    [notificationData],
  );

  return (
    <div className="dashboard-page" data-testid="dashboard-page">
      <Title level={4} style={{ marginBottom: 16 }}>
        {t('menu.dashboard')}
      </Title>

      <Row gutter={[16, 16]}>
        {/* 今日排班概要 */}
        <Col xs={24} md={12} lg={8}>
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
            <Space style={{ marginTop: 12 }} wrap>
              <Tag color="success">
                {t('dashboard.clean')} {todaySummary.clean}
              </Tag>
              <Tag color="error">
                {t('dashboard.warning')} {todaySummary.violated}
              </Tag>
              <Tag color="warning">
                {t('dashboard.overridden')} {todaySummary.overridden}
              </Tag>
            </Space>
          </Card>
        </Col>

        {/* 待審核項目 */}
        <Col xs={24} md={12} lg={8}>
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

        {/* 近期警示 */}
        <Col xs={24} md={24} lg={8}>
          <Card
            title={
              <Space>
                <AlertOutlined />
                {t('dashboard.recentAlerts')}
              </Space>
            }
            loading={taskLoading}
            data-testid="recent-alerts-card"
            extra={
              <Button type="link" onClick={() => navigate('/task')}>
                {t('dashboard.viewTasks')}
              </Button>
            }
          >
            {recentAlerts.length === 0 ? (
              <Empty description={t('dashboard.noRecentAlerts')} />
            ) : (
              <List
                size="small"
                dataSource={recentAlerts}
                renderItem={(task) => (
                  <List.Item key={task.id}>
                    <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                      <span>
                        {task.groupName} {task.branchName}（{task.date}）
                      </span>
                      <AlertBadge
                        status={task.alertStatus === 'OVERRIDDEN' ? 'overridden' : 'warning'}
                      />
                    </Space>
                  </List.Item>
                )}
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
                      <Tag color="blue">{t(NOTIFICATION_TYPE_KEYS[item.type]) || item.type}</Tag>
                      <Text strong>{item.subject}</Text>
                      <Text type="secondary">收件人：{item.recipientName}</Text>
                    </Space>
                    <Space size={12}>
                      <Tag color={statusConfig?.color}>
                        {t(NOTIFICATION_STATUS_KEYS[item.status]) || item.status}
                      </Tag>
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
    </div>
  );
};

export default DashboardPage;
