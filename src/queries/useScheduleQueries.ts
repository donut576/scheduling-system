import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleApi } from '@/api/schedule';
import type { ScheduleUpdateData } from '@/api/schedule';
import type { ScheduleData, ScheduleParams } from '@/types/schedule';
import { taskKeys } from './useTaskQueries';

// Query key factory for schedule-related queries
export const scheduleKeys = {
  all: ['schedule'] as const,
  data: (params: ScheduleParams) => [...scheduleKeys.all, params] as const,
};

/**
 * Hook for fetching schedule data with dimension, dateRange, filters, and AbortSignal support.
 * Supports both customer and employee dimension views.
 *
 * Validates: Requirements 8.7, 17.5
 */
export function useScheduleData(params: ScheduleParams) {
  return useQuery<ScheduleData>({
    queryKey: scheduleKeys.data(params),
    queryFn: async ({ signal }) => {
      const response = await scheduleApi.get(params, signal);
      return response.data.data;
    },
  });
}

/**
 * Mutation hook for updating schedule (batch changes: add/update/remove events).
 * Invalidates both schedule and task list queries on success since schedule
 * changes affect task data as well.
 */
export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ScheduleUpdateData>({
    mutationFn: async (data) => {
      await scheduleApi.update(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
