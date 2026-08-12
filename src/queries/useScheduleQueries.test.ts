import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { scheduleKeys, useScheduleData, useUpdateSchedule } from './useScheduleQueries';
import type { ScheduleParams } from '@/types/schedule';

// Mock the schedule API module
vi.mock('@/api/schedule', () => ({
  scheduleApi: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

import { scheduleApi } from '@/api/schedule';

const mockedScheduleApi = vi.mocked(scheduleApi);

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

describe('scheduleKeys', () => {
  it('generates correct key structures', () => {
    expect(scheduleKeys.all).toEqual(['schedule']);
    const params: ScheduleParams = {
      dimension: 'employee',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    };
    expect(scheduleKeys.data(params)).toEqual(['schedule', params]);
  });
});

describe('useScheduleData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches schedule data with dimension and date range', async () => {
    const mockData = {
      events: [
        {
          id: 'evt-1',
          taskId: 'task-1',
          resourceId: 'emp-1',
          title: 'Test Event',
          start: '2025-01-01T09:00:00+08:00',
          end: '2025-01-01T17:00:00+08:00',
          groupName: 'Group A',
          branchName: 'Branch 1',
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
      ],
      resources: [{ id: 'emp-1', title: 'Employee A' }],
    };

    mockedScheduleApi.get.mockResolvedValue({
      data: { code: 0, message: 'ok', data: mockData },
    } as never);

    const params: ScheduleParams = {
      dimension: 'employee',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      groupId: 'g1',
    };

    const { result } = renderHook(() => useScheduleData(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(mockedScheduleApi.get).toHaveBeenCalledWith(params, expect.any(AbortSignal));
  });

  it('passes AbortSignal to the API call', async () => {
    mockedScheduleApi.get.mockResolvedValue({
      data: { code: 0, message: 'ok', data: { events: [], resources: [] } },
    } as never);

    const params: ScheduleParams = {
      dimension: 'customer',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    };

    renderHook(() => useScheduleData(params), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockedScheduleApi.get).toHaveBeenCalled();
    });

    const callArgs = mockedScheduleApi.get.mock.calls[0];
    expect(callArgs).toBeDefined();
    expect(callArgs?.[1]).toBeInstanceOf(AbortSignal);
  });

  it('uses different query keys for different params', () => {
    const params1: ScheduleParams = {
      dimension: 'customer',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    };
    const params2: ScheduleParams = {
      dimension: 'employee',
      startDate: '2025-02-01',
      endDate: '2025-02-28',
    };

    const key1 = scheduleKeys.data(params1);
    const key2 = scheduleKeys.data(params2);

    expect(key1).not.toEqual(key2);
  });
});

describe('useUpdateSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates schedule with batch changes', async () => {
    mockedScheduleApi.update.mockResolvedValue({
      data: { code: 0, message: 'ok', data: null },
    } as never);

    const { result } = renderHook(() => useUpdateSchedule(), {
      wrapper: createWrapper(),
    });

    const changes = {
      changes: [
        { type: 'update' as const, taskId: 'task-1', data: { startTime: '10:00' } },
        { type: 'remove' as const, taskId: 'task-2' },
      ],
    };

    result.current.mutate(changes);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedScheduleApi.update).toHaveBeenCalledWith(changes);
  });
});
