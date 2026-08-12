/**
 * 員工（Employee）相關的 React Query hooks。
 * 提供員工列表查詢、單一員工詳情查詢，以及新增／更新／刪除員工的變更操作。
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { employeeApi } from '@/api/employee';
import type { EmployeeListParams, EmployeeFormData } from '@/api/employee';
import type { Employee } from '@/types/employee';
import type { PaginatedResponse } from '@/types/common';

// 員工相關查詢的 query key 工廠函式，統一管理快取鍵值結構
export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  // 依照篩選參數產生不同的快取鍵，讓不同篩選條件的結果各自快取
  list: (params: EmployeeListParams) => [...employeeKeys.lists(), params] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
};

/**
 * 取得分頁員工列表的 hook，支援篩選條件與 AbortSignal（可中斷請求）。
 * 使用 keepPreviousData 讓分頁切換時畫面能平滑過渡，不會閃爍成 loading 狀態。
 *
 * Validates: Requirements 11.1
 */
export function useEmployeeList(params: EmployeeListParams) {
  return useQuery<PaginatedResponse<Employee>>({
    queryKey: employeeKeys.list(params),
    queryFn: async ({ signal }) => {
      const response = await employeeApi.list(params, signal);
      return response.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * 依 ID 取得單一員工詳情資料的 hook。
 * 只有在提供 id 時才會啟用查詢（enabled: !!id）。
 */
export function useEmployeeDetail(id: string | undefined) {
  return useQuery<Employee>({
    queryKey: employeeKeys.detail(id!),
    queryFn: async ({ signal }) => {
      const response = await employeeApi.detail(id!, signal);
      return response.data.data;
    },
    enabled: !!id,
  });
}

/**
 * 新增員工的變更（mutation）hook。
 * 成功後會讓員工列表查詢的快取失效，以重新取得最新資料。
 */
export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation<Employee, Error, EmployeeFormData>({
    mutationFn: async (data) => {
      const response = await employeeApi.create(data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}

/**
 * 更新既有員工資料的變更（mutation）hook。
 * 成功後會同時讓員工列表快取與該員工的詳情快取失效，
 * 確保列表與詳情頁都能反映最新資料。
 */
export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation<Employee, Error, { id: string; data: Partial<EmployeeFormData> }>({
    mutationFn: async ({ id, data }) => {
      const response = await employeeApi.update(id, data);
      return response.data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: employeeKeys.detail(variables.id),
      });
    },
  });
}

/**
 * 刪除員工的變更（mutation）hook。
 * 成功後會讓員工列表查詢的快取失效。
 */
export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation<null, Error, string>({
    mutationFn: async (id) => {
      const response = await employeeApi.delete(id);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
}
