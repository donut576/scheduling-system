/**
 * 審核（Approval）相關的 React Query hooks。
 * 提供審核請求列表查詢，以及核准／拒絕審核請求的變更操作。
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { approvalApi } from '@/api/approval';
import type { ApprovalListParams } from '@/api/approval';
import type { Approval } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';

// 審核相關查詢的 query key 工廠函式，統一管理快取鍵值結構
export const approvalKeys = {
  all: ['approvals'] as const,
  lists: () => [...approvalKeys.all, 'list'] as const,
  // 依照篩選參數產生不同的快取鍵，讓不同篩選條件的結果各自快取
  list: (params: ApprovalListParams) => [...approvalKeys.lists(), params] as const,
};

/**
 * 取得分頁審核請求列表的 hook，支援篩選條件與 AbortSignal（可中斷請求）。
 * 使用 keepPreviousData 讓分頁切換時畫面能平滑過渡，不會閃爍成 loading 狀態。
 *
 * Validates: Requirements 13.1, 13.2
 */
export function useApprovalList(params: ApprovalListParams) {
  return useQuery<PaginatedResponse<Approval>>({
    queryKey: approvalKeys.list(params),
    queryFn: async ({ signal }) => {
      const response = await approvalApi.list(params, signal);
      return response.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * 核准審核請求的變更（mutation）hook。
 * 成功後會讓審核列表查詢的快取失效，以重新取得最新資料。
 *
 * Validates: Requirements 13.2
 */
export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation<null, Error, { id: string; comment?: string }>({
    mutationFn: async ({ id, comment }) => {
      const response = await approvalApi.approve(id, comment);
      return response.data.data;
    },
    onSuccess: () => {
      // 核准成功後，讓所有審核列表與任務列表快取失效，觸發重新查詢以取得最新狀態
      queryClient.invalidateQueries({ queryKey: approvalKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

/**
 * 拒絕審核請求的變更（mutation）hook。
 * 依 approvalApi.reject 的介面規範，拒絕時必須提供 comment（理由）。
 * 成功後會讓審核列表查詢的快取失效。
 *
 * Validates: Requirements 13.2
 */
export function useRejectRequest() {
  const queryClient = useQueryClient();

  return useMutation<null, Error, { id: string; comment: string }>({
    mutationFn: async ({ id, comment }) => {
      const response = await approvalApi.reject(id, comment);
      return response.data.data;
    },
    onSuccess: () => {
      // 拒絕成功後，同樣讓審核列表與任務列表快取失效以重新取得最新資料
      queryClient.invalidateQueries({ queryKey: approvalKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
