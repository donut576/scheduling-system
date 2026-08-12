import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { notificationApi } from '@/api/notification';
import type { NotificationListParams, SendNotificationData } from '@/api/notification';
import type { Notification, NotificationTemplate } from '@/types/notification';
import type { PaginatedResponse } from '@/types/common';

// Query key factory for notification-related queries
export const notificationKeys = {
  all: ['notifications'] as const,
  lists: () => [...notificationKeys.all, 'list'] as const,
  list: (params: NotificationListParams) => [...notificationKeys.lists(), params] as const,
  templates: () => [...notificationKeys.all, 'templates'] as const,
};

/**
 * Hook for fetching paginated notification list with filtering and AbortSignal support.
 * Uses keepPreviousData for smooth pagination transitions.
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
 * Mutation hook for sending notifications to recipients.
 * Invalidates notification list queries on success.
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
 * Hook for fetching notification templates.
 * Templates rarely change, so no keepPreviousData needed.
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
 * Mutation hook for updating a notification template (subject/content).
 * Invalidates the template list query on success.
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
