import type { FC } from 'react';
import { Row, Col, Typography } from 'antd';
import { useUserStore } from '@/stores/useUserStore';
import PersonalTaskCard from './components/PersonalTaskCard';
import TaskChangeCard from './components/TaskChangeCard';
import SystemNotificationCard from './components/SystemNotificationCard';
import SendLogCard from './components/SendLogCard';

const { Text, Title } = Typography;

/**
 * Dashboard 首頁（依角色顯示三種版面）
 *
 * - 員工：個人任務（日／週／月）＋ 近期任務異動
 * - 主任：今日班表（自己轄區）＋ 系統通知（審核結果、證照到期）＋ 近期通知發送紀錄
 * - 副理／管理員：今日班表（全部轄區）＋ 近期通知發送紀錄
 */
const DashboardPage: FC = () => {
  const user = useUserStore((state) => state.user);
  const role = user?.role || 'ADMIN';
  const isStaff = role === 'STAFF';

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

      {/* 卡片並排佈局：員工／主任／副理與管理員各一種 */}
      {isStaff ? (
        <Row gutter={[16, 16]} align="top">
          <Col xs={24} lg={12}>
            <PersonalTaskCard variant="personal" />
          </Col>
          <Col xs={24} lg={12}>
            <TaskChangeCard />
          </Col>
        </Row>
      ) : role === 'LEADER' ? (
        <Row gutter={[16, 16]} align="top">
          <Col xs={24} lg={8}>
            <PersonalTaskCard variant="today" />
          </Col>
          <Col xs={24} lg={8}>
            <SystemNotificationCard />
          </Col>
          <Col xs={24} lg={8}>
            <SendLogCard />
          </Col>
        </Row>
      ) : (
        <Row gutter={[16, 16]} align="top">
          <Col xs={24} lg={12}>
            <PersonalTaskCard variant="today" />
          </Col>
          <Col xs={24} lg={12}>
            <SendLogCard />
          </Col>
        </Row>
      )}
    </div>
  );
};

export default DashboardPage;
