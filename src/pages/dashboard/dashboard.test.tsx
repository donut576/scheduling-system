import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import DashboardPage from './index';
import type { ScheduleData } from '@/types/schedule';
import type { Task } from '@/types/task';
import type { Approval } from '@/types/notification';
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

import { useScheduleData } from '@/queries/useScheduleQueries';
import { useApprovalList } from '@/queries/useApprovalQueries';
import { useTaskList } from '@/queries/useTaskQueries';

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
      alertStatus: 'VIOLATED',
      isRecurring: false,
      isOvernight: false,
      extendedProps: {
        taskType: 'CONTRACT',
        shift: 'DAY',
        assignees: [],
        contents: ['P'],
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
  });

  describe('今日排班概要', () => {
    it('renders today schedule summary with total count and alert breakdown', () => {
      render(<DashboardPage />);

      const card = screen.getByTestId('today-schedule-card');
      expect(card).toBeInTheDocument();
      expect(screen.getByText('今日任務數')).toBeInTheDocument();
      // 2 total events: 1 CLEAN + 1 VIOLATED
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('正常 1')).toBeInTheDocument();
      expect(screen.getByText('警示 1')).toBeInTheDocument();
      expect(screen.getByText('已覆蓋 0')).toBeInTheDocument();
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

    it('navigates to /approval when 前往審批 link is clicked', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await user.click(screen.getByText('前往審批'));
      expect(mockNavigate).toHaveBeenCalledWith('/approval');
    });
  });

  describe('近期警示', () => {
    it('renders recent tasks with VIOLATED or OVERRIDDEN alert status', () => {
      render(<DashboardPage />);

      const card = screen.getByTestId('recent-alerts-card');
      expect(card).toBeInTheDocument();
      expect(screen.getByText(/集團C 分店C/)).toBeInTheDocument();
      expect(screen.getByText(/集團D 分店D/)).toBeInTheDocument();
    });

    it('navigates to /task when 查看任務列表 link is clicked', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await user.click(screen.getByText('查看任務列表'));
      expect(mockNavigate).toHaveBeenCalledWith('/task');
    });
  });

  describe('快捷入口', () => {
    it('renders quick entry buttons for 任務建立、排班總覽、通知中心', () => {
      render(<DashboardPage />);

      const card = screen.getByTestId('quick-entry-card');
      expect(card).toBeInTheDocument();
      expect(screen.getByText('任務建立')).toBeInTheDocument();
      expect(screen.getByText('排班總覽')).toBeInTheDocument();
      expect(screen.getByText('通知中心')).toBeInTheDocument();
    });

    it('navigates to /task when 任務建立 quick entry is clicked', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await user.click(screen.getByText('任務建立'));
      expect(mockNavigate).toHaveBeenCalledWith('/task');
    });

    it('navigates to /schedule when 排班總覽 quick entry is clicked', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      const buttons = screen.getAllByText('排班總覽');
      await user.click(buttons[buttons.length - 1]!);
      expect(mockNavigate).toHaveBeenCalledWith('/schedule');
    });

    it('navigates to /notification when 通知中心 quick entry is clicked', async () => {
      const user = userEvent.setup();
      render(<DashboardPage />);

      await user.click(screen.getByText('通知中心'));
      expect(mockNavigate).toHaveBeenCalledWith('/notification');
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

    it('shows empty state when there are no recent alerts', () => {
      vi.mocked(useTaskList).mockReturnValue({
        data: mockTaskListData([]),
        isLoading: false,
        isError: false,
        error: null,
      } as unknown as ReturnType<typeof useTaskList>);

      render(<DashboardPage />);
      expect(screen.getByText('近期無警示項目')).toBeInTheDocument();
    });
  });
});
