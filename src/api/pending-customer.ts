// 待處理客戶（Pending Customer）相關 API 呼叫層
// 提供待處理客戶清單查詢、新增、更新，以及轉換為正式任務等操作
import apiInstance from './instance';
import type { PendingCustomer } from '@/types/customer';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

// 查詢待處理客戶清單所需的參數
export interface PendingCustomerListParams {
  page?: number; // 目前頁碼
  pageSize?: number; // 每頁筆數
  status?: string; // 依狀態篩選
  groupId?: string; // 依客戶群組篩選
}

// 新增或編輯待處理客戶時使用的表單資料結構
export interface PendingCustomerFormData {
  groupId: string; // 客戶群組 id
  branchId: string; // 分店/據點 id
  date?: string; // 排班日期
  startTime?: string; // 開始時間
  endTime?: string; // 結束時間
  headcount: number; // 需求人數
  shift?: string; // 班別
  remarks?: string; // 備註
}

// 將待處理客戶轉換為正式任務時所需的資料結構
export interface ConvertToTaskData {
  date: string; // 任務日期
  startTime: string; // 開始時間
  endTime: string; // 結束時間
  shift: string; // 班別
  headcount: number; // 需求人數
}

export const pendingCustomerApi = {
  // 取得分頁待處理客戶清單
  list: (params: PendingCustomerListParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<PaginatedResponse<PendingCustomer>>>('/pending-customers', {
      params,
      signal,
    }),

  // 新增一筆待處理客戶資料
  create: (data: PendingCustomerFormData) =>
    apiInstance.post<ApiResponse<PendingCustomer>>('/pending-customers', data),

  // 更新指定 id 的待處理客戶資料（部分欄位更新）
  update: (id: string, data: Partial<PendingCustomerFormData>) =>
    apiInstance.patch<ApiResponse<PendingCustomer>>(`/pending-customers/${id}`, data),

  // 將指定 id 的待處理客戶轉換為正式任務
  convert: (id: string, data: ConvertToTaskData) =>
    apiInstance.post<ApiResponse<null>>(`/pending-customers/${id}/convert`, data),
};
