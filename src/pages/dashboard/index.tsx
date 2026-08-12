import { useMemo } from 'react';
import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Row, Col, Card, Statistic, List, Button, Space, Tag, Typography, Empty } from 'antd';
import {
  CalendarOutlined,
  AuditOutlined,
  AlertOutlined,
  PlusOutlined,
  BellOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { useScheduleData } from '@/queries/useScheduleQueries';
import { useApprovalList } from '@/queries/useApprovalQueries';
import { useTaskList } from '@/queries/useTaskQueries';
import AlertBadge from '@/components/business/AlertBadge';
import { APPROVAL_TYPE_MAP } from '@/constants/approvalTypes';
import { getToday, dayjs } from '@/utils/date';
import type { Task } from '@/types/task';

const { Text, Title } = Typography;

/**
 * Dashboard 首頁
 *
 * 作為登入後之預設首頁（Requirement 2.1：登入成功後依角色建立可存取路由，
 * 首頁為所有角色共同之登陸頁面），提供三項概要資訊與快捷入口：
 *
 * - 今日排班概要：以 useScheduleData 查詢當日（dimension=customer）排班事件，
 *   統計今日任務數並依 alertStatus 分類（正常/警示/已覆蓋）。
 * - 待審核項目：以 useApprovalList 查詢 status=PENDING 之審批單，顯示件數與
 *   最近幾筆列表。
 * - 近期警示：以 useTaskList 查詢近 7 日內任務，篩選出 alertStatus 為
 *   VIOLATED 或 OVERRIDDEN 之任務（即「近期警示」，對應 Alert_Engine 產生
 *   之違規/覆蓋標記，而非通知模組），取最近 5 筆顯示。
 * - 快捷入口：任務建立（導向 /task，該頁提供「新增任務」按鈕）、排班總覽
 *   （導向 /schedule）、通知中心。
 *
 *   關於「通知中心」快捷入口：NotificationCenter 元件原設計為 AppHeader 鈴鐺
 *   圖標觸發之彈出面板，若直接嵌入 Dashboard 頁面內將與 AppHeader 之呈現重複
 *   且需額外處理版面配置。因此此處選擇較單純的作法：提供一個按鈕導向完整的
 *   通知管理頁面（/notification），使用者可在該頁查看所有通知列表、發送通知
 *   與管理範本，功能較嵌入式面板更完整。
 *
 * Validates: Requirements 2.1
 */
/**
 * Dashboard 首頁主元件
 * 彙整今日排班、待審核項目、近期警示三張概要卡片與快捷入口按鈕
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
                renderItem={(item) => (
                  <List.Item key={item.id}>
                    <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                      <span>{APPROVAL_TYPE_MAP[item.type] ?? item.type}</span>
                      <Text type="secondary">{item.requestedByName}</Text>
                    </Space>
                  </List.Item>
                )}
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

      {/* 快捷入口 */}
      <Card
        title={t('dashboard.quickEntry')}
        style={{ marginTop: 16 }}
        data-testid="quick-entry-card"
      >
        <Space wrap size="middle">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/task')}>
            {t('task.create')}
          </Button>
          <Button icon={<ScheduleOutlined />} onClick={() => navigate('/schedule')}>
            {t('menu.schedule')}
          </Button>
          <Button icon={<BellOutlined />} onClick={() => navigate('/notification')}>
            {t('notification.center')}
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default DashboardPage;
