/**
 * 客戶（Customer）相關的 React Query hooks。
 * 提供客戶列表查詢、客戶群組查詢，以及新增／更新／刪除客戶的變更操作。
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { customerApi } from '@/api/customer';
import type { CustomerListParams, CustomerFormData } from '@/api/customer';
import type { Customer, CustomerGroup } from '@/types/customer';
import type { PaginatedResponse } from '@/types/common';

// 客戶相關查詢的 query key 工廠函式，統一管理快取鍵值結構
export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  // 依照篩選參數產生不同的快取鍵，讓不同篩選條件的結果各自快取
  list: (params: CustomerListParams) => [...customerKeys.lists(), params] as const,
  groups: () => [...customerKeys.all, 'groups'] as const,
};

/**
 * 取得分頁客戶列表的 hook，支援篩選條件與 AbortSignal（可中斷請求）。
 * 使用 keepPreviousData 讓分頁切換時畫面能平滑過渡，不會閃爍成 loading 狀態。
 *
 * Validates: Requirements 10.1
 */
export function useCustomerList(params: CustomerListParams) {
  return useQuery<PaginatedResponse<Customer>>({
    queryKey: customerKeys.list(params),
    queryFn: async ({ signal }) => {
      const response = await customerApi.list(params, signal);
      return response.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * 取得客戶群組列表的 hook（用於串聯選單／下拉選單元件）。
 */
export function useCustomerGroups() {
  return useQuery<CustomerGroup[]>({
    queryKey: customerKeys.groups(),
    queryFn: async ({ signal }) => {
      const response = await customerApi.groups(signal);
      return response.data.data;
    },
  });
}

/**
 * 新增客戶的變更（mutation）hook。
 * 成功後會讓客戶列表查詢的快取失效，以重新取得最新資料。
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, CustomerFormData>({
    mutationFn: async (data) => {
      const response = await customerApi.create(data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

/**
 * 更新既有客戶資料的變更（mutation）hook。
 * 成功後會讓客戶列表查詢的快取失效。
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation<Customer, Error, { id: string; data: Partial<CustomerFormData> }>({
    mutationFn: async ({ id, data }) => {
      const response = await customerApi.update(id, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}

/**
 * 刪除客戶的變更（mutation）hook。
 * 成功後會讓客戶列表查詢的快取失效。
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation<null, Error, string>({
    mutationFn: async (id) => {
      const response = await customerApi.delete(id);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
  });
}
