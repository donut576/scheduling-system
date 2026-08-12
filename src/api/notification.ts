// 通知（Notification）相關 API 呼叫層
// 提供通知清單查詢、發送通知、範本查詢與更新等操作
import apiInstance from './instance';
import type { Notification, NotificationTemplate } from '@/types/notification';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

// 查詢通知清單所需的參數
export interface NotificationListParams {
  page?: number; // 目前頁碼
  pageSize?: number; // 每頁筆數
  type?: string; // 依通知類型篩選
  status?: string; // 依通知狀態篩選
}

// 發送通知時使用的資料結構
export interface SendNotificationData {
  templateId: string; // 使用的通知範本 id
  recipientType: 'CUSTOMER' | 'EMPLOYEE'; // 接收者類型：客戶或員工
  recipientIds: string[]; // 接收者 id 清單
  taskId?: string; // 關聯的任務 id（若有）
  variables?: Record<string, string>; // 範本變數替換內容
}

export const notificationApi = {
  // 取得分頁通知清單
  list: (params: NotificationListParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<PaginatedResponse<Notification>>>('/notifications', {
      params,
      signal,
    }),

  // 發送通知
  send: (data: SendNotificationData) =>
    apiInstance.post<ApiResponse<null>>('/notifications/send', data),

  // 取得所有通知範本清單
  getTemplates: (signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<NotificationTemplate[]>>('/notifications/templates', { signal }),

  // 更新指定 id 的通知範本（部分欄位更新）
  updateTemplate: (id: string, data: Partial<NotificationTemplate>) =>
    apiInstance.patch<ApiResponse<NotificationTemplate>>(`/notifications/templates/${id}`, data),
};
