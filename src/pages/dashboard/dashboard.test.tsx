// Dashboard 首頁 (DashboardPage) 單元測試
// 測試對象：src/pages/dashboard/index.tsx（員工／主任／副理與管理員三種版面）
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import DashboardPage from './index';
import { useUserStore } from '@/stores/useUserStore';
import { toDateStr } from './personalTasks';
import type { ScheduleData } from '@/types/schedule';
import type { Notification } from '@/types/notification';

// Mock window.matchMedia for Ant Design responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/queries/useScheduleQueries', () => ({
  useScheduleData: vi.fn(),
}));
vi.mock('@/queries/useCustomerQueries', () => ({
  useCustomerList: vi.fn(() => ({ data: { list: [], total: 0 } })),
}));
vi.mock('@/queries/useEmployeeQueries', () => ({
  useEmployeeList: vi.fn(() => ({ data: { list: [], total: 0 } })),
}));
vi.mock('@/queries/useNotificationQueries', () => ({
  useNotificationList: vi.fn(),
  useMarkNotificationRead: () => ({ mutate: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn() }),
}));

import { useScheduleData } from '@/queries/useScheduleQueries';
import { useNotificationList } from '@/queries/useNotificationQueries';

const TODAY = toDateStr(new Date());

const makeEvent = (
  id: string,
  group: string,
  branch: string,
  assignees: { employeeId: string; employeeName: string }[],
  headcount = 1,
) => ({
  id,
  taskId: `task-${id}`,
  resourceId: `branch-${id}`,
  title: `${group} ${branch}`,
  start: `${TODAY}T14:30:00`,
  end: `${TODAY}T16:00:00`,
  groupName: group,
  branchName: branch,
  alertStatus: 'CLEAN' as const,
  isRecurring: false,
  isOvernight: false,
  extendedProps: {
    taskType: 'CONTRACT' as const,
    shift: '北早',
    assignees: assignees.map((a) => ({ ...a, licenses: [] })),
    contents: ['P' as const],
    headcount,
  },
});

const scheduleData: ScheduleData = {
  events: [
    makeEvent('1', '集團A', '分店A', [{ employeeId: 'emp-demo', employeeName: 'Demo 員工' }]),
    // 指派人數不足（待排）→ 不應顯示
    makeEvent('2', '集團B', '分店B', [{ employeeId: 'emp-x', employeeName: '李四' }], 2),
    // 其他人的任務 → 員工看不到
    makeEvent('3', '集團C', '分店C', [{ employeeId: 'emp-x', employeeName: '李四' }]),
  ],
  resources: [],
};

const mockNotifications = (list: Notification[]) =>
  vi.mocked(useNotificationList).mockReturnValue({
    data: { list, total: list.length, page: 1, pageSize: 50 },
    isLoading: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useNotificationList>);

const setUser = (role: 'ADMIN' | 'MANAGER' | 'LEADER' | 'STAFF', id = 'emp-demo', name = 'Demo') =>
  useUserStore.setState({
    user: { id, name, employeeNo: 'E01', role, permissions: [] },
  } as never);

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser('ADMIN', 'emp-admin', 'Admin');

    vi.mocked(useScheduleData).mockReturnValue({
      data: scheduleData,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useScheduleData>);

    mockNotifications([]);
  });

  describe('副理／管理員版面', () => {
    it('顯示今日班表、近期通知發送紀錄兩張卡片，沒有待審核項目', () => {
      render(<DashboardPage />);
      expect(screen.getByTestId('today-schedule-card')).toBeInTheDocument();
      expect(screen.getByTestId('send-log-card')).toBeInTheDocument();
      expect(screen.queryByTestId('pending-approval-card')).not.toBeInTheDocument();
    });

    it('今日班表只列已排滿的任務（待排不顯示）', () => {
      render(<DashboardPage />);
      const card = screen.getByTestId('today-schedule-card');
      expect(within(card).getByText('集團A · 分店A')).toBeInTheDocument();
      expect(within(card).getByText('集團C · 分店C')).toBeInTheDocument();
      expect(within(card).queryByText('集團B · 分店B')).not.toBeInTheDocument();
      expect(within(card).getAllByText('1430')).toHaveLength(2);
    });

    it('通知發送紀錄：列出收件對象，點擊開啟通知發送詳情', async () => {
      mockNotifications([
        {
          id: 'notif-99',
          type: 'CUSTOMER_NOTIFY',
          recipientType: 'CUSTOMER',
          recipientId: 'cust-99',
          recipientName: '鼎泰豐 - 信義旗艦店',
          subject: '服務排程確認通知',
          content: '尊敬的客戶您好：您的排班已確認。',
          status: 'NOTIFIED',
          createdAt: new Date().toISOString(),
        },
      ]);
      const user = userEvent.setup();
      render(<DashboardPage />);
      expect(screen.getByText('任務・客戶')).toBeInTheDocument();
      await user.click(screen.getByText('鼎泰豐 - 信義旗艦店'));
      expect(await screen.findByText('通知發送詳情')).toBeInTheDocument();
      expect(screen.getByText('尊敬的客戶您好：您的排班已確認。')).toBeInTheDocument();
    });
  });

  describe('主任版面', () => {
    it('顯示今日班表、系統通知、近期通知發送紀錄，沒有待審核項目', () => {
      setUser('LEADER', 'emp-leader', 'Demo 主任');
      render(<DashboardPage />);
      expect(screen.getByText('Hi, Demo 主任！')).toBeInTheDocument();
      expect(screen.getByText('今日班表')).toBeInTheDocument();
      expect(screen.getByTestId('system-notification-card')).toBeInTheDocument();
      expect(screen.getByTestId('send-log-card')).toBeInTheDocument();
      expect(screen.queryByTestId('pending-approval-card')).not.toBeInTheDocument();
    });
  });

  describe('員工版面', () => {
    beforeEach(() => setUser('STAFF', 'emp-demo', 'Demo 員工'));

    it('顯示個人任務與近期任務異動，沒有待審核項目', () => {
      render(<DashboardPage />);
      expect(screen.getByText('Hi, Demo 員工！')).toBeInTheDocument();
      expect(screen.getByText('個人任務')).toBeInTheDocument();
      expect(screen.getByTestId('recent-notifications-card')).toBeInTheDocument();
      expect(screen.queryByTestId('pending-approval-card')).not.toBeInTheDocument();
    });

    it('只列自己的已排滿任務，並提供日／週／月分頁', () => {
      render(<DashboardPage />);
      const card = screen.getByTestId('today-schedule-card');
      expect(within(card).getByText('集團A · 分店A')).toBeInTheDocument();
      expect(within(card).queryByText('集團C · 分店C')).not.toBeInTheDocument();
      expect(within(card).getByText('共 1 筆')).toBeInTheDocument();
      ['日', '週', '月'].forEach((label) =>
        expect(within(card).getByRole('button', { name: label })).toBeInTheDocument(),
      );
    });

    it('切到「週」會改成區間標籤', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);
      await user.click(screen.getByRole('button', { name: '週' }));
      expect(screen.getByTestId('range-label').textContent).toMatch(/\d+\/\d+ – \d+\/\d+/);
    });

    it('點任務列開啟詳細視窗，自己的名字標「（我）」', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);
      await user.click(screen.getByTestId('task-row'));
      expect(await screen.findByText('任務詳細')).toBeInTheDocument();
      expect(screen.getByText('Demo 員工（我）')).toBeInTheDocument();
    });
  });
});
