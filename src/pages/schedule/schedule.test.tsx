// 排班總覽頁面 (SchedulePage) 單元測試
// 測試對象：src/pages/schedule/index.tsx，涵蓋檢視切換（日/週/月）、工具列篩選、
// 事件點擊開啟詳情小框與拖拉放大至日檢視
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SchedulePage from './index';
import { useScheduleStore } from '@/stores/useScheduleStore';
import type { ScheduleEvent } from '@/types/schedule';
import type { CustomerGroup } from '@/types/customer';
import type { Employee } from '@/types/employee';

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

// Mock query hooks used by the schedule page
const mockUpdateTaskMutateAsync = vi.fn().mockResolvedValue(undefined);
vi.mock('@/queries/useCustomerQueries', () => ({
  useCustomerGroups: vi.fn(),
}));
vi.mock('@/queries/useEmployeeQueries', () => ({
  useEmployeeList: vi.fn(),
}));
vi.mock('@/queries/useTaskQueries', () => ({
  useTaskDetail: vi.fn(),
  useUpdateTask: vi.fn(),
}));

import { useCustomerGroups } from '@/queries/useCustomerQueries';
import { useEmployeeList } from '@/queries/useEmployeeQueries';
import { useTaskDetail, useUpdateTask } from '@/queries/useTaskQueries';

// Mock ScheduleCalendar - it is FullCalendar-based and already has its own test
// suite. Replace it with a simple stand-in that exposes its props so the page's
// event-click handling and filter wiring can be verified in isolation.
let lastScheduleCalendarProps: Record<string, unknown> | undefined;
vi.mock('@/components/business/ScheduleCalendar', () => ({
  default: (props: Record<string, unknown>) => {
    lastScheduleCalendarProps = props;
    const onEventClick = props.onEventClick as (event: ScheduleEvent) => void;
    const onZoomToDay = props.onZoomToDay as ((dateTime: string) => void) | undefined;
    const renderEventDetail = props.renderEventDetail as
      ((event: ScheduleEvent) => ReactNode) | undefined;
    const onEventDetailClose = props.onEventDetailClose as (() => void) | undefined;
    const openEventId = props.openEventId as string | undefined;
    return (
      <div data-testid="mock-schedule-calendar">
        <button type="button" onClick={() => onEventClick(sampleEvent)}>
          觸發事件點擊
        </button>
        <button type="button" onClick={() => onZoomToDay?.('2025-03-12T13:30:00')}>
          觸發拖拉放大
        </button>
        {openEventId === sampleEvent.id && renderEventDetail?.(sampleEvent)}
        {openEventId === sampleEvent.id && (
          <button type="button" onClick={onEventDetailClose}>
            關閉小框
          </button>
        )}
      </div>
    );
  },
}));

const sampleEvent: ScheduleEvent = {
  id: 'evt-1',
  taskId: 'task-1',
  resourceId: 'branch-1',
  title: '集團A 分店A',
  start: '2025-03-10T09:00:00+08:00',
  end: '2025-03-10T17:00:00+08:00',
  groupName: '集團A',
  branchName: '分店A',
  alertStatus: 'CLEAN',
  isRecurring: false,
  isOvernight: false,
  extendedProps: {
    taskType: 'CONTRACT',
    shift: 'DAY',
    assignees: [{ employeeId: 'e1', employeeName: '員工A', licenses: [] }],
    contents: ['P'],
  },
};

const customerGroups: CustomerGroup[] = [
  {
    id: 'g1',
    name: '集團A',
    branches: [
      {
        id: 'b1',
        groupId: 'g1',
        name: '分店A',
        address: '地址A',
        contactName: '聯絡人A',
        contactPhone: '0900000000',
        requiredLicenses: [],
      },
      {
        id: 'b2',
        groupId: 'g1',
        name: '分店B',
        address: '地址B',
        contactName: '聯絡人B',
        contactPhone: '0900000001',
        requiredLicenses: [],
      },
    ],
  },
  {
    id: 'g2',
    name: '集團B',
    branches: [],
  },
];

const employees: Employee[] = [
  {
    id: 'e1',
    name: '員工A',
    phone: '0911111111',
    employeeNo: 'E001',
    position: 'STAFF',
    groupId: 'area1',
    groupName: '北區',
    groupColor: '#ff0000',
    designatedLeaves: [],
    licenses: [],
    isActive: true,
  },
];

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderPage = () => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SchedulePage />
    </QueryClientProvider>,
  );
};

/**
 * Unit Tests for 排班總覽頁面 (Schedule Overview Page)
 * Validates: Requirements 8.1, 8.2, 9.1
 */
describe('SchedulePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastScheduleCalendarProps = undefined;

    useScheduleStore.setState({
      currentView: 'week',
      dimension: 'customer',
      dateRange: { start: '2025-03-09', end: '2025-03-15' },
    });

    vi.mocked(useCustomerGroups).mockReturnValue({
      data: customerGroups,
    } as unknown as ReturnType<typeof useCustomerGroups>);

    vi.mocked(useEmployeeList).mockReturnValue({
      data: { list: employees, total: employees.length, page: 1, pageSize: 500 },
    } as unknown as ReturnType<typeof useEmployeeList>);

    vi.mocked(useTaskDetail).mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useTaskDetail>);

    vi.mocked(useUpdateTask).mockReturnValue({
      mutateAsync: mockUpdateTaskMutateAsync,
    } as unknown as ReturnType<typeof useUpdateTask>);
  });

  describe('檢視切換 (View Mode Switching) - Requirement 8.1', () => {
    it('renders day/week/month view switch with current view selected', () => {
      renderPage();
      const segmented = screen.getByLabelText('檢視切換');
      expect(segmented).toBeInTheDocument();
      expect(screen.getByText('日')).toBeInTheDocument();
      expect(screen.getByText('週')).toBeInTheDocument();
      expect(screen.getByText('月')).toBeInTheDocument();
    });

    it('calls setView with "day" when 日 option is clicked', async () => {
      const setViewSpy = vi.spyOn(useScheduleStore.getState(), 'setView');
      renderPage();

      const user = userEvent.setup();
      await user.click(screen.getByText('日'));

      expect(setViewSpy).toHaveBeenCalledWith('day');
    });

    it('calls setView with "month" when 月 option is clicked', async () => {
      const setViewSpy = vi.spyOn(useScheduleStore.getState(), 'setView');
      renderPage();

      const user = userEvent.setup();
      await user.click(screen.getByText('月'));

      expect(setViewSpy).toHaveBeenCalledWith('month');
    });

    it('updates currentView in the store and reflects new view selection', async () => {
      renderPage();

      const user = userEvent.setup();
      await user.click(screen.getByText('日'));

      await waitFor(() => {
        expect(useScheduleStore.getState().currentView).toBe('day');
      });
    });

    it('zooms to day view when the calendar table is dragged', async () => {
      renderPage();

      const user = userEvent.setup();
      await user.click(screen.getByText('觸發拖拉放大'));

      await waitFor(() => {
        expect(useScheduleStore.getState().currentView).toBe('day');
        expect(useScheduleStore.getState().dateRange).toEqual({
          start: '2025-03-12',
          end: '2025-03-12',
        });
      });

      expect(lastScheduleCalendarProps?.scrollTime).toBe('13:30');
    });
  });

  describe('工具列篩選 (Toolbar Filters) - Requirement 8.2', () => {
    it('renders customer branch, employee and area filter selects', () => {
      renderPage();
      expect(screen.getByRole('combobox', { name: '搜尋集團 / 分店' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: '員工篩選' })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: '區域篩選' })).toBeInTheDocument();
    });

    it('passes selected customer branch filter through to ScheduleCalendar filters prop', async () => {
      renderPage();

      const user = userEvent.setup();
      const customerBranchSelect = screen.getByRole('combobox', { name: '搜尋集團 / 分店' });
      await user.click(customerBranchSelect);
      await user.click(await screen.findByTitle('集團A 分店A'));

      await waitFor(() => {
        expect((lastScheduleCalendarProps?.filters as { groupId?: string })?.groupId).toBe('g1');
        expect((lastScheduleCalendarProps?.filters as { branchId?: string })?.branchId).toBe('b1');
      });
    });

    it('clears group and branch filters when customer branch filter is cleared', async () => {
      renderPage();

      const user = userEvent.setup();
      const customerBranchSelect = screen.getByRole('combobox', { name: '搜尋集團 / 分店' });
      await user.click(customerBranchSelect);
      await user.click(await screen.findByTitle('集團A 分店A'));

      await waitFor(() => {
        expect((lastScheduleCalendarProps?.filters as { branchId?: string })?.branchId).toBe('b1');
      });

      const clearButton = document.querySelector('.ant-select-clear');
      expect(clearButton).toBeInTheDocument();
      await user.click(clearButton!);

      await waitFor(() => {
        expect(
          (lastScheduleCalendarProps?.filters as { groupId?: string })?.groupId,
        ).toBeUndefined();
        expect(
          (lastScheduleCalendarProps?.filters as { branchId?: string })?.branchId,
        ).toBeUndefined();
      });
    });

    it('passes selected employee filter through to ScheduleCalendar filters prop', async () => {
      renderPage();

      const user = userEvent.setup();
      const employeeSelect = screen.getByRole('combobox', { name: '員工篩選' });
      await user.click(employeeSelect);
      await user.click(await screen.findByTitle('員工A'));

      await waitFor(() => {
        expect((lastScheduleCalendarProps?.filters as { employeeId?: string })?.employeeId).toBe(
          'e1',
        );
      });
    });

    it('passes selected area filter through to ScheduleCalendar filters prop', async () => {
      renderPage();

      const user = userEvent.setup();
      const areaSelect = screen.getByRole('combobox', { name: '區域篩選' });
      await user.click(areaSelect);
      await user.click(await screen.findByTitle('北區'));

      await waitFor(() => {
        expect((lastScheduleCalendarProps?.filters as { areaId?: string })?.areaId).toBe('area1');
      });
    });
  });

  describe('事件點擊開啟詳情小框 (Event Click Opens Detail Popover) - Requirement 9.1', () => {
    it('does not show the detail popover initially', () => {
      renderPage();
      expect(screen.queryByText('任務詳情')).not.toBeInTheDocument();
      expect(screen.queryByText('集團: 集團A')).not.toBeInTheDocument();
    });

    it('opens the detail popover showing task info when an event block is clicked', async () => {
      renderPage();

      const user = userEvent.setup();
      await user.click(screen.getByText('觸發事件點擊'));

      await waitFor(() => {
        expect(screen.getByText('集團: 集團A')).toBeInTheDocument();
      });

      expect(screen.getByText('分店: 分店A')).toBeInTheDocument();
      expect(screen.getByText('指派人員: 員工A')).toBeInTheDocument();
    });

    it('shows edit and cancel buttons in the detail popover', async () => {
      renderPage();

      const user = userEvent.setup();
      await user.click(screen.getByText('觸發事件點擊'));

      await waitFor(() => {
        expect(screen.getByLabelText('編輯任務')).toBeInTheDocument();
      });
      expect(screen.getByLabelText('取消任務')).toBeInTheDocument();
    });

    it('closes the detail popover when close is triggered', async () => {
      renderPage();

      const user = userEvent.setup();
      await user.click(screen.getByText('觸發事件點擊'));

      await waitFor(() => {
        expect(screen.getByText('集團: 集團A')).toBeInTheDocument();
      });

      await user.click(screen.getByText('關閉小框'));

      await waitFor(() => {
        expect(screen.queryByText('集團: 集團A')).not.toBeInTheDocument();
      });
    });
  });
});
