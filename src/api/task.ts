import apiInstance from './instance';
import type { Task, TaskFormData, TaskListParams } from '@/types/task';
import type { AlertValidationResult } from '@/types/alert';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

export const taskApi = {
  list: (params: TaskListParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<PaginatedResponse<Task>>>('/tasks', { params, signal }),

  detail: (id: string, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<Task>>(`/tasks/${id}`, { signal }),

  create: (data: TaskFormData) => apiInstance.post<ApiResponse<Task>>('/tasks', data),

  update: (id: string, data: Partial<TaskFormData>) =>
    apiInstance.patch<ApiResponse<Task>>(`/tasks/${id}`, data),

  validate: (id: string, data: TaskFormData) =>
    apiInstance.post<ApiResponse<AlertValidationResult>>(`/tasks/${id}/validate`, data),

  overrideWarning: (id: string, remark: string) =>
    apiInstance.post<ApiResponse<null>>(`/tasks/${id}/override-warning`, { remark }),
};
