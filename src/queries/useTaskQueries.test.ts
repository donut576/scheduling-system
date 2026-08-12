import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import {
  taskKeys,
  useTaskList,
  useTaskDetail,
  useCreateTask,
  useUpdateTask,
  useValidateTask,
} from './useTaskQueries';
import type { TaskListParams } from '@/types/task';

// Mock the task API module
vi.mock('@/api/task', () => ({
  taskApi: {
    list: vi.fn(),
    detail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    validate: vi.fn(),
  },
}));

// Import mocked module
import { taskApi } from '@/api/task';

const mockedTaskApi = vi.mocked(taskApi);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('taskKeys', () => {
  it('generates correct key structures', () => {
    expect(taskKeys.all).toEqual(['tasks']);
    expect(taskKeys.lists()).toEqual(['tasks', 'list']);
    expect(taskKeys.list({ page: 1, pageSize: 10 })).toEqual([
      'tasks',
      'list',
      { page: 1, pageSize: 10 },
    ]);
    expect(taskKeys.details()).toEqual(['tasks', 'detail']);
    expect(taskKeys.detail('abc')).toEqual(['tasks', 'detail', 'abc']);
  });
});

describe('useTaskList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches task list with params and returns paginated data', async () => {
    const mockData = {
      list: [{ id: '1', groupName: 'Group A' }],
      total: 1,
      page: 1,
      pageSize: 10,
    };
    mockedTaskApi.list.mockResolvedValue({
      data: { code: 0, message: 'ok', data: mockData },
    } as never);

    const params: TaskListParams = { page: 1, pageSize: 10, keyword: 'test' };
    const { result } = renderHook(() => useTaskList(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(mockedTaskApi.list).toHaveBeenCalledWith(params, expect.any(AbortSignal));
  });

  it('passes AbortSignal to the API call', async () => {
    mockedTaskApi.list.mockResolvedValue({
      data: { code: 0, message: 'ok', data: { list: [], total: 0, page: 1, pageSize: 10 } },
    } as never);

    const params: TaskListParams = { page: 1, pageSize: 10 };
    renderHook(() => useTaskList(params), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockedTaskApi.list).toHaveBeenCalled();
    });

    const callArgs = mockedTaskApi.list.mock.calls[0];
    expect(callArgs).toBeDefined();
    expect(callArgs?.[1]).toBeInstanceOf(AbortSignal);
  });
});

describe('useTaskDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches task detail by ID', async () => {
    const mockTask = { id: '123', groupName: 'Group B' };
    mockedTaskApi.detail.mockResolvedValue({
      data: { code: 0, message: 'ok', data: mockTask },
    } as never);

    const { result } = renderHook(() => useTaskDetail('123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTask);
    expect(mockedTaskApi.detail).toHaveBeenCalledWith('123', expect.any(AbortSignal));
  });

  it('does not fetch when id is undefined', () => {
    const { result } = renderHook(() => useTaskDetail(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedTaskApi.detail).not.toHaveBeenCalled();
  });
});

describe('useCreateTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a task and returns the created task', async () => {
    const mockTask = { id: 'new-1', groupName: 'Group C' };
    mockedTaskApi.create.mockResolvedValue({
      data: { code: 0, message: 'ok', data: mockTask },
    } as never);

    const { result } = renderHook(() => useCreateTask(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      groupId: 'g1',
      branchId: 'b1',
      taskType: 'CONTRACT',
      date: '2025-01-01',
      startTime: '09:00',
      endTime: '17:00',
      headcount: 2,
      shift: 'DAY',
      route: 'R1',
      contents: ['P'],
      assignees: ['emp1'],
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTask);
  });
});

describe('useUpdateTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a task with partial data', async () => {
    const mockTask = { id: 'task-1', groupName: 'Updated' };
    mockedTaskApi.update.mockResolvedValue({
      data: { code: 0, message: 'ok', data: mockTask },
    } as never);

    const { result } = renderHook(() => useUpdateTask(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ id: 'task-1', data: { headcount: 3 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTask);
    expect(mockedTaskApi.update).toHaveBeenCalledWith('task-1', { headcount: 3 });
  });
});

describe('useValidateTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates a task and returns validation result', async () => {
    const mockResult = { isValid: false, violations: [], canOverride: true };
    mockedTaskApi.validate.mockResolvedValue({
      data: { code: 0, message: 'ok', data: mockResult },
    } as never);

    const { result } = renderHook(() => useValidateTask(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      id: 'task-1',
      data: {
        groupId: 'g1',
        branchId: 'b1',
        taskType: 'CONTRACT',
        date: '2025-01-01',
        startTime: '09:00',
        endTime: '17:00',
        headcount: 2,
        shift: 'DAY',
        route: 'R1',
        contents: ['P'],
        assignees: ['emp1'],
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockResult);
  });
});
