/**
 * 任務（Task）相關的 React Query hooks。
 * 提供任務列表查詢、單一任務詳情查詢、新增／更新任務，
 * 以及依警示規則進行任務驗證的操作。
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { taskApi } from '@/api/task';
import type { Task, TaskFormData, TaskListParams } from '@/types/task';
import type { AlertValidationResult } from '@/types/alert';
import type { PaginatedResponse } from '@/types/common';

// 任務相關查詢的 query key 工廠函式，統一管理快取鍵值結構
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  // 依照篩選參數產生不同的快取鍵，讓不同篩選條件的結果各自快取
  list: (params: TaskListParams) => [...taskKeys.lists(), params] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

/**
 * 取得分頁任務列表的 hook，支援篩選條件與 AbortSignal（可中斷請求）。
 * 使用 keepPreviousData 讓分頁切換時畫面能平滑過渡，不會閃爍成 loading 狀態。
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
 * 依 ID 取得單一任務詳情資料的 hook。
 * 只有在提供 id 時才會啟用查詢（enabled: !!id）。
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
 * 新增任務的變更（mutation）hook。
 * 成功後會讓任務列表查詢的快取失效，以重新取得最新資料。
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
 * 更新既有任務資料的變更（mutation）hook。
 * 成功後會同時讓任務列表快取與該任務的詳情快取失效，
 * 確保列表與詳情頁都能反映最新資料。
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
 * 依警示規則驗證任務內容（伺服器端驗證）的變更（mutation）hook。
 * 驗證屬於類似「讀取」的操作，不會實際變更資料，因此不會使任何快取失效。
 */
export function useValidateTask() {
  return useMutation<AlertValidationResult, Error, { id: string; data: TaskFormData }>({
    mutationFn: async ({ id, data }) => {
      const response = await taskApi.validate(id, data);
      return response.data.data;
    },
  });
}
