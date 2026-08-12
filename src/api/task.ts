// 任務（Task）相關 API 呼叫層
// 提供任務清單查詢、詳細資料查詢、新增、更新、驗證與警示覆寫等操作
import apiInstance from './instance';
import type { Task, TaskFormData, TaskListParams } from '@/types/task';
import type { AlertValidationResult } from '@/types/alert';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

export const taskApi = {
  // 取得分頁任務清單
  list: (params: TaskListParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<PaginatedResponse<Task>>>('/tasks', { params, signal }),

  // 取得指定 id 的任務詳細資料
  detail: (id: string, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<Task>>(`/tasks/${id}`, { signal }),

  // 新增一筆任務
  create: (data: TaskFormData) => apiInstance.post<ApiResponse<Task>>('/tasks', data),

  // 更新指定 id 的任務資料（部分欄位更新）
  update: (id: string, data: Partial<TaskFormData>) =>
    apiInstance.patch<ApiResponse<Task>>(`/tasks/${id}`, data),

  // 驗證任務資料是否有衝突或警示（例如排班衝突、證照不符等）
  validate: (id: string, data: TaskFormData) =>
    apiInstance.post<ApiResponse<AlertValidationResult>>(`/tasks/${id}/validate`, data),

  // 覆寫（忽略）驗證警示，需附帶覆寫原因
  overrideWarning: (id: string, remark: string) =>
    apiInstance.post<ApiResponse<null>>(`/tasks/${id}/override-warning`, { remark }),
};
