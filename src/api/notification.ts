import apiInstance from './instance';
import type { Notification, NotificationTemplate } from '@/types/notification';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

export interface NotificationListParams {
  page?: number;
  pageSize?: number;
  type?: string;
  status?: string;
}

export interface SendNotificationData {
  templateId: string;
  recipientType: 'CUSTOMER' | 'EMPLOYEE';
  recipientIds: string[];
  taskId?: string;
  variables?: Record<string, string>;
}

export const notificationApi = {
  list: (params: NotificationListParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<PaginatedResponse<Notification>>>('/notifications', {
      params,
      signal,
    }),

  send: (data: SendNotificationData) =>
    apiInstance.post<ApiResponse<null>>('/notifications/send', data),

  getTemplates: (signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<NotificationTemplate[]>>('/notifications/templates', { signal }),

  updateTemplate: (id: string, data: Partial<NotificationTemplate>) =>
    apiInstance.patch<ApiResponse<NotificationTemplate>>(`/notifications/templates/${id}`, data),
};
