/**
 * 待處理客戶（Pending Customer）相關的 React Query hooks。
 * 提供待處理客戶列表查詢，以及新增／更新／轉換為正式任務的變更操作。
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { pendingCustomerApi } from '@/api/pending-customer';
import type {
  PendingCustomerListParams,
  PendingCustomerFormData,
  ConvertToTaskData,
} from '@/api/pending-customer';
import type { PendingCustomer } from '@/types/customer';
import type { PaginatedResponse } from '@/types/common';
import { taskKeys } from './useTaskQueries';

// 待處理客戶相關查詢的 query key 工廠函式，統一管理快取鍵值結構
export const pendingCustomerKeys = {
  all: ['pending-customers'] as const,
  lists: () => [...pendingCustomerKeys.all, 'list'] as const,
  // 依照篩選參數產生不同的快取鍵，讓不同篩選條件的結果各自快取
  list: (params: PendingCustomerListParams) => [...pendingCustomerKeys.lists(), params] as const,
};

/**
 * 取得分頁待處理客戶列表的 hook，支援篩選條件與 AbortSignal（可中斷請求）。
 * 使用 keepPreviousData 讓分頁切換時畫面能平滑過渡，不會閃爍成 loading 狀態。
 *
 * Validates: Requirements 14.1
 */
export function usePendingCustomerList(params: PendingCustomerListParams) {
  return useQuery<PaginatedResponse<PendingCustomer>>({
    queryKey: pendingCustomerKeys.list(params),
    queryFn: async ({ signal }) => {
      const response = await pendingCustomerApi.list(params, signal);
      return response.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * 新增待處理客戶的變更（mutation）hook。
 * 成功後會讓待處理客戶列表查詢的快取失效。
 */
export function useCreatePendingCustomer() {
  const queryClient = useQueryClient();

  return useMutation<PendingCustomer, Error, PendingCustomerFormData>({
    mutationFn: async (data) => {
      const response = await pendingCustomerApi.create(data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingCustomerKeys.lists() });
    },
  });
}

/**
 * 更新既有待處理客戶資料的變更（mutation）hook。
 * 成功後會讓待處理客戶列表查詢的快取失效。
 */
export function useUpdatePendingCustomer() {
  const queryClient = useQueryClient();

  return useMutation<
    PendingCustomer,
    Error,
    { id: string; data: Partial<PendingCustomerFormData> }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await pendingCustomerApi.update(id, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingCustomerKeys.lists() });
    },
  });
}

/**
 * 將待處理客戶轉換為正式任務的變更（mutation）hook。
 * 由於轉換會建立一筆新的任務，成功後需同時讓待處理客戶列表
 * 與任務列表的快取都失效，確保兩邊資料都能反映最新狀態。
 */
export function useConvertPendingCustomer() {
  const queryClient = useQueryClient();

  return useMutation<null, Error, { id: string; data: ConvertToTaskData }>({
    mutationFn: async ({ id, data }) => {
      const response = await pendingCustomerApi.convert(id, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingCustomerKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
