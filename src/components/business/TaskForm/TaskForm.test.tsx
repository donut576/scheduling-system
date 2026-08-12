/**
 * 測試對象：TaskForm 元件（單元測試）
 * 使用 mock 的 ConflictPanel、EmployeeSelect、RecurrenceEditor 及查詢 hooks，
 * 驗證表單欄位渲染、集團→分店連動、必填驗證等表單層行為。
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TaskForm from './index';
import type { Task } from '@/types/task';

// Mock matchMedia for Ant Design
beforeAll(() => {
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
});

// Mock modules
vi.mock('@/queries/useCustomerQueries', () => ({
  useCustomerGroups: () => ({
    data: [
      {
        id: 'group-1',
        name: '集團A',
        branches: [
          {
            id: 'branch-1',
            groupId: 'group-1',
            name: '分店A1',
            address: '台北市',
            contactName: '王先生',
            contactPhone: '0912345678',
            requiredLicenses: ['PROFESSIONAL'],
          },
          {
            id: 'branch-2',
            groupId: 'group-1',
            name: '分店A2',
            address: '新北市',
            contactName: '李先生',
            contactPhone: '0923456789',
            requiredLicenses: [],
          },
        ],
      },
      {
        id: 'group-2',
        name: '集團B',
        branches: [
          {
            id: 'branch-3',
            groupId: 'group-2',
            name: '分店B1',
            address: '桃園市',
            contactName: '陳先生',
            contactPhone: '0934567890',
            requiredLicenses: [],
          },
        ],
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/queries/useEmployeeQueries', () => ({
  useEmployeeList: () => ({
    data: {
      list: [
        {
          id: 'emp-1',
          name: '張三',
          phone: '0911111111',
          employeeNo: 'E001',
          position: 'STAFF',
          groupId: 'group-1',
          groupName: '集團A',
          groupColor: '#1890ff',
          designatedLeaves: [],
          licenses: ['PROFESSIONAL'],
          isActive: true,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 500,
    },
    isLoading: false,
  }),
}));

vi.mock('@/queries/useTaskQueries', () => ({
  useTaskList: () => ({
    data: { list: [], total: 0, page: 1, pageSize: 200 },
    isLoading: false,
  }),
}));

vi.mock('@/stores/useDictStore', () => ({
  useDictStore: () => ({
    taskTypes: [
      { label: '合約', value: 'CONTRACT' },
      { label: '單次', value: 'ONETIME' },
      { label: 'ESR', value: 'ESR' },
    ],
    shifts: [
      { label: '台北早班', value: 'DAY' },
      { label: '台北晚班', value: 'NIGHT' },
    ],
    routes: [{ label: '路線A', value: 'ROUTE_A' }],
    contents: [
      { label: 'P', value: 'P' },
      { label: 'R', value: 'R' },
      { label: 'S', value: 'S' },
      { label: '其他', value: 'OTHER' },
    ],
  }),
}));

vi.mock('@/stores/useTaskStore', () => ({
  useTaskStore: () => ({
    setAlertResults: vi.fn(),
  }),
}));

vi.mock('@/components/business/EmployeeSelect', () => ({
  default: ({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) => (
    <div data-testid="employee-select">
      <span>Selected: {value.length}</span>
      <button onClick={() => onChange(['emp-1'])}>Select Employee</button>
    </div>
  ),
}));

vi.mock('@/components/business/RecurrenceEditor', () => ({
  default: ({ onChange }: { onChange: (rule: unknown) => void }) => (
    <div data-testid="recurrence-editor">
      <button onClick={() => onChange({ frequency: 'daily', interval: 1, endType: 'never' })}>
        Set Daily
      </button>
    </div>
  ),
}));

vi.mock('@/components/business/ConflictPanel', () => ({
  default: ({
    violations,
    onOverride,
    canOverride,
  }: {
    violations: unknown[];
    onOverride: (remark: string) => void;
    canOverride: boolean;
  }) => (
    <div data-testid="conflict-panel">
      <span>Violations: {violations.length}</span>
      {canOverride && <button onClick={() => onOverride('override reason')}>Override</button>}
    </div>
  ),
}));

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe('TaskForm', () => {
  let onSubmit: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onSubmit = vi.fn().mockResolvedValue(undefined);
    onCancel = vi.fn();
  });

  it('renders the form with all required fields', () => {
    renderWithProviders(<TaskForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    // Use role-based queries for Ant Design Select (combobox)
    expect(screen.getByRole('combobox', { name: '集團' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '分店' })).toBeInTheDocument();
    // 任務類型 is rendered as three mutually-exclusive checkboxes
    expect(screen.getByRole('checkbox', { name: '合約' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '單次' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'ESR' })).toBeInTheDocument();
    expect(screen.getByLabelText('任務日期')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '開始時間' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '結束時間' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: '人數需求' })).toBeInTheDocument();
    // 內容 is rendered as checkboxes (mocked useDictStore contents: P/R/S)
    expect(screen.getByRole('checkbox', { name: 'P' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'R' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'S' })).toBeInTheDocument();
    expect(screen.getByLabelText('備註')).toBeInTheDocument();
    expect(screen.getByTestId('employee-select')).toBeInTheDocument();
  });

  it('renders create mode button text', () => {
    renderWithProviders(<TaskForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    expect(screen.getByRole('button', { name: '儲存' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部清除' })).toBeInTheDocument();
  });

  it('renders edit mode button text', () => {
    const mockTask: Task = {
      id: 'task-1',
      groupId: 'group-1',
      groupName: '集團A',
      branchId: 'branch-1',
      branchName: '分店A1',
      taskType: 'CONTRACT',
      date: '2024-03-15',
      startTime: '09:00',
      endTime: '17:00',
      isOvernight: false,
      headcount: 2,
      shift: 'DAY',
      route: 'ROUTE_A',
      contents: ['P', 'R'],
      assignees: [{ employeeId: 'emp-1', employeeName: '張三', licenses: ['PROFESSIONAL'] }],
      remarks: 'test remark',
      status: 'SCHEDULED',
      alertStatus: 'CLEAN',
      createdBy: 'admin',
      createdAt: '2024-03-01T00:00:00+08:00',
      updatedAt: '2024-03-01T00:00:00+08:00',
    };

    renderWithProviders(
      <TaskForm mode="edit" initialData={mockTask} onSubmit={onSubmit} onCancel={onCancel} />,
    );

    expect(screen.getByRole('button', { name: '儲存' })).toBeInTheDocument();
  });

  it('disables branch select when no group is selected', () => {
    renderWithProviders(<TaskForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    // The branch combobox should be disabled
    const branchSelect = screen.getByRole('combobox', { name: '分店' });
    expect(branchSelect).toBeDisabled();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaskForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows cross-day hint text', () => {
    renderWithProviders(<TaskForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    expect(screen.getByText(/若結束時間早於起始時間，將自動視為跨日任務/)).toBeInTheDocument();
  });

  it('shows recurrence editor when checkbox is toggled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaskForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    // Initially recurrence editor should not be visible
    expect(screen.queryByTestId('recurrence-editor')).not.toBeInTheDocument();

    // Toggle on
    const toggle = screen.getByRole('checkbox', { name: '啟用週期' });
    await user.click(toggle);

    await waitFor(() => {
      expect(screen.getByTestId('recurrence-editor')).toBeInTheDocument();
    });
  });

  it('clears all fields and local state back to defaults when 全部清除 is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaskForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    // Enable recurrence (local component state, independent of AntD Form internals)
    // so we can reliably observe it being reset back to off.
    await user.click(screen.getByRole('checkbox', { name: '啟用週期' }));
    await waitFor(() => {
      expect(screen.getByTestId('recurrence-editor')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '全部清除' }));

    await waitFor(() => {
      expect(screen.queryByTestId('recurrence-editor')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('checkbox', { name: '啟用週期' })).not.toBeChecked();
  });

  it('shows the free-text note field only when 其他 is checked in 內容', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaskForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    expect(screen.queryByLabelText('其他內容說明')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: '其他' }));

    expect(screen.getByLabelText('其他內容說明')).toBeInTheDocument();
  });

  it('renders the task-form data-testid', () => {
    renderWithProviders(<TaskForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    expect(screen.getByTestId('task-form')).toBeInTheDocument();
  });

  it('does not render the map button in the task form', () => {
    renderWithProviders(<TaskForm mode="create" onSubmit={onSubmit} onCancel={onCancel} />);

    expect(screen.queryByRole('button', { name: '地圖檢視' })).not.toBeInTheDocument();
  });
});
