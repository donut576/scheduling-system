// 客戶（Customer）相關 API 呼叫層
// 提供客戶清單查詢、群組查詢、新增、更新與刪除等操作
import apiInstance from './instance';
import type { Customer, CustomerGroup } from '@/types/customer';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

// 查詢客戶清單所需的參數
export interface CustomerListParams {
  page?: number; // 目前頁碼
  pageSize?: number; // 每頁筆數
  keyword?: string; // 關鍵字搜尋
  groupId?: string; // 依客戶群組篩選
}

// 新增或編輯客戶時使用的表單資料結構
export interface CustomerFormData {
  groupName: string; // 客戶群組名稱
  branchName: string; // 分店/據點名稱
  address: string; // 地址
  latitude?: number; // 緯度（用於地圖顯示）
  longitude?: number; // 經度（用於地圖顯示）
  contactName: string; // 聯絡人姓名
  contactPhone: string; // 聯絡人電話
  requiredLicenses: string[]; // 所需證照清單
  remarks?: string; // 備註
}

export const customerApi = {
  // 取得分頁客戶清單
  list: (params: CustomerListParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<PaginatedResponse<Customer>>>('/customers', { params, signal }),

  // 取得所有客戶群組清單
  groups: (signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<CustomerGroup[]>>('/customers/groups', { signal }),

  // 新增一筆客戶資料
  create: (data: CustomerFormData) => apiInstance.post<ApiResponse<Customer>>('/customers', data),

  // 更新指定 id 的客戶資料（部分欄位更新）
  update: (id: string, data: Partial<CustomerFormData>) =>
    apiInstance.patch<ApiResponse<Customer>>(`/customers/${id}`, data),

  // 刪除指定 id 的客戶資料
  delete: (id: string) => apiInstance.delete<ApiResponse<null>>(`/customers/${id}`),
};
