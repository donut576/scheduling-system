/**
 * 通知（Notification）相關的 React Query hooks。
 * 提供通知列表查詢、通知範本查詢，以及發送通知／更新範本的變更操作。
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { notificationApi } from '@/api/notification';
import type { NotificationListParams, SendNotificationData } from '@/api/notification';
import type { Notification, NotificationTemplate } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';

// 通知相關查詢的 query key 工廠函式，統一管理快取鍵值結構
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  // 依照篩選參數產生不同的快取鍵，讓不同篩選條件的結果各自快取
  list: (params: NotificationListParams) => [...notificationKeys.lists(), params] as const,
  templates: () => [...notificationKeys.all, 'templates'] as const,
};

/**
 * 取得分頁通知列表的 hook，支援篩選條件與 AbortSignal（可中斷請求）。
 * 使用 keepPreviousData 讓分頁切換時畫面能平滑過渡，不會閃爍成 loading 狀態。
 *
 * Validates: Requirements 12.1
 */
export function useNotificationList(params: NotificationListParams) {
  return useQuery<PaginatedResponse<Notification>>({
    queryKey: notificationKeys.list(params),
    queryFn: async ({ signal }) => {
      const response = await notificationApi.list(params, signal);
      return response.data.data;
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * 發送通知給接收者的變更（mutation）hook。
 * 成功後會讓通知列表查詢的快取失效。
 */
export function useSendNotification() {
  const queryClient = useQueryClient();

  return useMutation<null, Error, SendNotificationData>({
    mutationFn: async (data) => {
      const response = await notificationApi.send(data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
}

/**
 * 取得通知範本列表的 hook。
 * 範本內容變動不頻繁，因此不需要 keepPreviousData。
 */
export function useNotificationTemplates() {
  return useQuery<NotificationTemplate[]>({
    queryKey: notificationKeys.templates(),
    queryFn: async ({ signal }) => {
      const response = await notificationApi.getTemplates(signal);
      return response.data.data;
    },
  });
}

/**
 * 更新通知範本（主旨／內容）的變更（mutation）hook。
 * 成功後會讓範本列表查詢的快取失效。
 *
 * Validates: Requirements 12.4
 */
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation<
    NotificationTemplate,
    Error,
    { id: string; data: Partial<NotificationTemplate> }
  >({
    mutationFn: async ({ id, data }) => {
      const response = await notificationApi.updateTemplate(id, data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.templates() });
    },
  });
}
