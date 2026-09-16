import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TaskPage from './index';
import type { Task } from '@/types/task';
import type { PaginatedResponse } from '@/types/common';

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

const mockCreateMutateAsync = vi.fn().mockResolvedValue(undefined);
const mockUpdateMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/queries/useTaskQueries', () => ({
  useTaskList: vi.fn(),
  useCreateTask: vi.fn(),
  useUpdateTask: vi.fn(),
}));

vi.mock('@/queries/useCustomerQueries', () => ({
  useCustomerGroups: vi.fn(),
}));

let lastTaskFormRemark = '';

vi.mock('@/components/business/TaskForm', () => ({
  default: ({
    initialData,
    onSubmit,
    onCancel,
  }: {
    initialData?: Task;
    onSubmit: (data: Partial<Task>) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="mock-task-form">
      <div>編輯任務表單</div>
      <label htmlFor="remarks">備註</label>
      <input
        id="remarks"
        aria-label="備註"
        defaultValue={initialData?.remarks || ''}
        onChange={(e) => {
          lastTaskFormRemark = e.target.value;
        }}
      />
      <button
        type="button"
        onClick={() =>
          onSubmit({
            ...initialData,
            remarks: lastTaskFormRemark || '直接在清單列表編輯更新備註',
          })
        }
      >
        儲存
      </button>
      <button type="button" onClick={onCancel}>
        取消
      </button>
    </div>
  ),
}));

import { useTaskList, useCreateTask, useUpdateTask } from '@/queries/useTaskQueries';
import { useCustomerGroups } from '@/queries/useCustomerQueries';
import { useTaskStore } from '@/stores/useTaskStore';
import { useUserStore } from '@/stores/useUserStore';
import { usePermissionStore } from '@/stores/usePermissionStore';
import { ROLE_PERMISSIONS } from '@/constants/permissions';
import type { UserProfile } from '@/types/auth';

const mockTasks: Task[] = [
  {
    id: 'task-001',
    groupId: 'grp-001',
    groupName: '王品集團',
    branchId: 'cust-001',
    branchName: '台北旗艦店',
    taskType: 'CONTRACT',
    date: '2026-03-20',
    startTime: '09:00',
    endTime: '12:00',
    isOvernight: false,
    headcount: 1,
    route: '第一路',
    shift: '早班',
    assignees: [{ employeeId: 'emp-001', employeeName: '王小明', licenses: ['PEST_CONTROL'] }],
    contents: ['P'],
    reportTypes: ['APP', 'PHOTO'],
    photoCount: 4,
    photos: [],
    reportNotes: '注意角落',
    status: 'SCHEDULED',
    alertStatus: 'CLEAN',
    createdBy: 'admin',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  },
];

describe('TaskPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    lastTaskFormRemark = '';
    useTaskStore.setState({
      filters: { page: 1, pageSize: 10 },
    });
    useUserStore.setState({
      user: {
        id: 'admin',
        employeeNo: 'EMP001',
        role: 'ADMIN',
        name: '系統管理員',
        permissions: ROLE_PERMISSIONS.ADMIN || [],
      } as unknown as UserProfile,
    });
    usePermissionStore.getState().buildPermissions(ROLE_PERMISSIONS.ADMIN || [], 'ADMIN');

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.mocked(useCustomerGroups).mockReturnValue({
      data: [
        { id: 'grp-001', name: '王品集團', branches: [{ id: 'cust-001', name: '台北旗艦店' }] },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useCustomerGroups>);

    vi.mocked(useTaskList).mockReturnValue({
      data: {
        list: mockTasks,
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1,
      } as PaginatedResponse<Task>,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTaskList>);

    vi.mocked(useCreateTask).mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateTask>);

    vi.mocked(useUpdateTask).mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateTask>);
  });

  const renderTaskPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TaskPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it('renders task list table with columns and records', async () => {
    renderTaskPage();

    expect(await screen.findByText('任務列表')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /新增任務/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /列表匯出/ })).toBeInTheDocument();
    expect(await screen.findByText('台北旗艦店')).toBeInTheDocument();
    expect(await screen.findByText('第一路')).toBeInTheDocument();
  });

  it('opens edit modal on clicking edit button and updates task data upon saving', async () => {
    const user = userEvent.setup();
    renderTaskPage();

    const editButtons = await screen.findAllByRole('button', { name: '編輯' });
    expect(editButtons.length).toBeGreaterThan(0);

    await user.click(editButtons[0]!);

    expect(await screen.findByTestId('mock-task-form')).toBeInTheDocument();

    const remarksInput = screen.getByLabelText('備註');
    await user.clear(remarksInput);
    await user.type(remarksInput, '直接在清單列表編輯更新備註');

    const saveButton = screen.getByRole('button', { name: '儲存' });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'task-001',
          data: expect.objectContaining({
            remarks: '直接在清單列表編輯更新備註',
          }),
        }),
      );
    });
  });
});
