import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { taskApi } from '@/api/task';
import type { Task, TaskFormData, TaskListParams } from '@/types/task';
import type { AlertValidationResult } from '@/types/alert';
import type { PaginatedResponse } from '@/types/common';

// Query key factory for task-related queries
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (params: TaskListParams) => [...taskKeys.lists(), params] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

/**
 * Hook for fetching paginated task list with filtering and AbortSignal support.
 * Uses keepPreviousData for smooth pagination transitions.
 *
 * Validates: Requirements 4.1, 4.3, 17.5
 */
export function useTaskList(params: TaskListParams) {
  return useQuery<PaginatedResponse<Task>>({
    queryKey: taskKeys.list(params),
    queryFn: async ({ signal }) => {
      const response = await taskApi.list(params, signal);
      return response.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * Hook for fetching a single task detail by ID.
 * Only enabled when id is provided.
 */
export function useTaskDetail(id: string | undefined) {
  return useQuery<Task>({
    queryKey: taskKeys.detail(id!),
    queryFn: async ({ signal }) => {
      const response = await taskApi.detail(id!, signal);
      return response.data.data;
    },
    enabled: !!id,
  });
}

/**
 * Mutation hook for creating a new task.
 * Invalidates task list queries on success.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, TaskFormData>({
    mutationFn: async (data) => {
      const response = await taskApi.create(data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/**
 * Mutation hook for updating an existing task.
 * Invalidates both the task list and the specific task detail on success.
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation<Task, Error, { id: string; data: Partial<TaskFormData> }>({
    mutationFn: async ({ id, data }) => {
      const response = await taskApi.update(id, data);
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: taskKeys.detail(variables.id),
      });
    },
  });
}

/**
 * Mutation hook for validating a task against alert rules (server-side).
 * Does not invalidate cache as validation is a read-like operation.
 */
export function useValidateTask() {
  return useMutation<AlertValidationResult, Error, { id: string; data: TaskFormData }>({
    mutationFn: async ({ id, data }) => {
      const response = await taskApi.validate(id, data);
      return response.data.data;
    },
  });
}
