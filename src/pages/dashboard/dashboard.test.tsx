// Dashboard 首頁 (DashboardPage) 單元測試
// 測試對象：src/pages/dashboard/index.tsx，涵蓋今日排班概要、待審核項目、
// 近期警示與快捷入口導覽
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import DashboardPage from './index';
import { useUserStore } from '@/stores/useUserStore';
import type { ScheduleData } from '@/types/schedule';
import type { Task } from '@/types/task';
import type { Approval, Notification } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';

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
vi.mock('@/queries/useApprovalQueries', () => ({
  useApprovalList: vi.fn(),
}));
vi.mock('@/queries/useTaskQueries', () => ({
  useTaskList: vi.fn(),
}));
vi.mock('@/queries/useNotificationQueries', () => ({
  useNotificationList: vi.fn(),
}));

import { useScheduleData } from '@/queries/useScheduleQueries';
import { useApprovalList } from '@/queries/useApprovalQueries';
import { useTaskList } from '@/queries/useTaskQueries';
import { useNotificationList } from '@/queries/useNotificationQueries';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { PERMISSIONS } from '@/constants/permissions';

const scheduleData: ScheduleData = {
  events: [
    {
      id: 'evt-1',
      taskId: 'task-1',
      resourceId: 'branch-1',
      title: '集團A 分店A',
      start: '2024-01-10T09:00:00+08:00',
      end: '2024-01-10T17:00:00+08:00',
      groupName: '集團A',
      branchName: '分店A',
      alertStatus: 'CLEAN',
      isRecurring: false,
      isOvernight: false,
      extendedProps: {
        taskType: 'CONTRACT',
        shift: 'DAY',
        assignees: [],
        contents: ['P'],
      },
    },
    {
      id: 'evt-2',
      taskId: 'task-2',
      resourceId: 'branch-2',
      title: '集團B 分店B',
      start: '2024-01-10T09:00:00+08:00',
      end: '2024-01-10T17:00:00+08:00',
      groupName: '集團B',
      branchName: '分店B',
      alertStatus: 'OVERRIDDEN',
      isRecurring: false,
      isOvernight: false,
      extendedProps: {
        taskType: 'CONTRACT',
        shift: 'DAY',
        assignees: [],
        contents: ['P'],
        overrideReason: '主管王經理已核准特許覆蓋',
      },
    },
  ],
  resources: [],
};

const pendingApproval: Approval = {
  id: 'a1',
  taskId: 't1',
  type: 'SCHEDULE_CHANGE',
  status: 'PENDING',
  requestedBy: 'u1',
  requestedByName: '王組長',
  approvers: [],
  createdAt: '2024-01-01T00:00:00+08:00',
  updatedAt: '2024-01-01T00:00:00+08:00',
};

const violatedTask: Task = {
  id: 'task-3',
  groupId: 'g1',
  groupName: '集團C',
  branchId: 'b1',
  branchName: '分店C',
  taskType: 'CONTRACT',
  date: '2024-01-09',
  startTime: '09:00',
  endTime: '17:00',
  isOvernight: false,
  headcount: 1,
  shift: 'DAY',
  route: 'R1',
  contents: ['P'],
  assignees: [],
  status: 'SCHEDULED',
  alertStatus: 'VIOLATED',
  createdBy: 'u1',
  createdAt: '2024-01-01T00:00:00+08:00',
  updatedAt: '2024-01-01T00:00:00+08:00',
};

const overriddenTask: Task = {
  ...violatedTask,
  id: 'task-4',
  groupName: '集團D',
  branchName: '分店D',
  date: '2024-01-08',
  alertStatus: 'OVERRIDDEN',
};

function mockApprovalListData(list: Approval[]): PaginatedResponse<Approval> {
  return { list, total: list.length, page: 1, pageSize: 5 };
}

function mockTaskListData(list: Task[]): PaginatedResponse<Task> {
  return { list, total: list.length, page: 1, pageSize: 100 };
}

/**
 * Unit Tests for Dashboard 首頁
 * Validates: Requirements 2.1
 */
describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePermissionStore.getState().buildPermissions(Object.values(PERMISSIONS), 'ADMIN');

    vi.mocked(useScheduleData).mockReturnValue({
      data: scheduleData,
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useScheduleData>);

    vi.mocked(useApprovalList).mockReturnValue({
      data: mockApprovalListData([pendingApproval]),
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useApprovalList>);

    vi.mocked(useTaskList).mockReturnValue({
      data: mockTaskListData([violatedTask, overriddenTask]),
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useTaskList>);

    vi.mocked(useNotificationList).mockReturnValue({
      data: { list: [], total: 0, page: 1, pageSize: 5 },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useNotificationList>);
  });

  describe('三大卡片並排與今日排班概要', () => {
    it('renders 3 side-by-side cards: schedule summary, pending approvals, and recent notifications', () => {
      render(<DashboardPage />);

      expect(screen.getByTestId('today-schedule-card')).toBeInTheDocument();
      expect(screen.getByTestId('pending-approval-card')).toBeInTheDocument();
      expect(screen.getByTestId('recent-notifications-card')).toBeInTheDocument();
    });

    it('renders today schedule summary with total count and clean/overridden breakdown without warning tag', () => {
      render(<DashboardPage />);

      const card = screen.getByTestId('today-schedule-card');
      expect(card).toBeInTheDocument();
      expect(screen.getByText('今日任務數')).toBeInTheDocument();
      // 2 total events: 1 CLEAN + 1 OVERRIDDEN
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('正常 1')).toBeInTheDocument();
      expect(screen.getByText(/已覆蓋 1/)).toBeInTheDocument();
      expect(screen.queryByText(/警示/)).not.toBeInTheDocument();
    });

    it('opens overridden alert notification modal when clicking overridden tag', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      const overriddenTag = screen.getByTestId('overridden-tag');
      await user.click(overriddenTag);

      expect(screen.getByText(/今日排班特許覆蓋通知/)).toBeInTheDocument();
      expect(screen.getByText(/集團B - 分店B/)).toBeInTheDocument();
      expect(screen.getByText(/主管王經理已核准特許覆蓋/)).toBeInTheDocument();
    });

    it('navigates to /schedule when 查看排班總覽 link is clicked', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await user.click(screen.getByText('查看排班總覽'));
      expect(mockNavigate).toHaveBeenCalledWith('/schedule');
    });
  });

  describe('待審核項目', () => {
    it('renders pending approval count and list', () => {
      render(<DashboardPage />);

      const card = screen.getByTestId('pending-approval-card');
      expect(card).toBeInTheDocument();
      expect(screen.getByText('待審核件數')).toBeInTheDocument();
      expect(screen.getByText('排班變更')).toBeInTheDocument();
      expect(screen.getByText('王組長')).toBeInTheDocument();
    });

    it('navigates to task approval tab when 查看細項 link is clicked for Admin', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await user.click(screen.getByText('查看細項'));
      expect(mockNavigate).toHaveBeenCalledWith('/task?tab=approval');
    });
  });

  describe('近期通知發送紀錄', () => {
    const mockSampleNotif: Notification = {
      id: 'notif-99',
      type: 'CUSTOMER_NOTIFY',
      recipientType: 'CUSTOMER',
      recipientId: 'cust-99',
      recipientName: '鼎泰豐 信義旗艦店',
      subject: '服務排程確認通知 - 信義旗艦店',
      content: '尊敬的客戶您好：您的排班已確認，服務時間為明日 09:00。',
      status: 'NOTIFIED',
      createdAt: '2026-08-18T10:00:00+08:00',
    };

    it('renders notification list and opens detail modal when item is clicked', async () => {
      vi.mocked(useNotificationList).mockReturnValue({
        data: { list: [mockSampleNotif], total: 1, page: 1, pageSize: 6 },
        isLoading: false,
        isError: false,
        error: null,
      } as unknown as ReturnType<typeof useNotificationList>);

      const user = userEvent.setup();
      render(<DashboardPage />);

      expect(screen.getByText('鼎泰豐 信義旗艦店')).toBeInTheDocument();
      expect(screen.getByText('服務排程確認通知 - 信義旗艦店')).toBeInTheDocument();

      // Click notification item to view details
      await user.click(screen.getByText('鼎泰豐 信義旗艦店'));

      expect(screen.getByText('通知發送詳情')).toBeInTheDocument();
      expect(
        screen.getByText('尊敬的客戶您好：您的排班已確認，服務時間為明日 09:00。'),
      ).toBeInTheDocument();
    });
  });

  describe('無資料狀態', () => {
    it('shows empty state when there are no pending approvals', () => {
      vi.mocked(useApprovalList).mockReturnValue({
        data: mockApprovalListData([]),
        isLoading: false,
        isError: false,
        error: null,
      } as unknown as ReturnType<typeof useApprovalList>);

      render(<DashboardPage />);
      expect(screen.getByText('目前無待審核項目')).toBeInTheDocument();
    });
  });

  describe('角色問候語與版面自適應', () => {
    it('displays personalized greeting with user name', () => {
      useUserStore.setState({
        user: {
          id: 'emp-demo',
          name: 'Demo 員工',
          employeeNo: 'STAFF01',
          role: 'STAFF',
          permissions: [],
        },
      });

      render(<DashboardPage />);
      expect(screen.getByText('Hi, Demo 員工！')).toBeInTheDocument();
      expect(screen.getByText('今日個人任務')).toBeInTheDocument();
      expect(screen.getByText('近期通知')).toBeInTheDocument();
      expect(screen.queryByTestId('pending-approval-card')).not.toBeInTheDocument();
    });

    it('renders 查看進度 button for LEADER', () => {
      useUserStore.setState({
        user: {
          id: 'emp-leader',
          name: 'Demo 組長',
          employeeNo: 'LEADER01',
          role: 'LEADER',
          permissions: [],
        },
      });

      render(<DashboardPage />);
      expect(screen.getByText('Hi, Demo 組長！')).toBeInTheDocument();
      expect(screen.getByText('查看進度')).toBeInTheDocument();
    });

    it('renders 前往審核 button for MANAGER', () => {
      useUserStore.setState({
        user: {
          id: 'emp-manager',
          name: '經理主管',
          employeeNo: 'MGR01',
          role: 'MANAGER',
          permissions: ['approval:approve'],
        },
      });

      render(<DashboardPage />);
      expect(screen.getByText('Hi, 經理主管！')).toBeInTheDocument();
      expect(screen.getByText('前往審核')).toBeInTheDocument();
    });
  });
});
