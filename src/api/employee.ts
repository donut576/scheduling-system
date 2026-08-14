// 員工（Employee）相關 API 呼叫層
// 提供員工清單查詢、詳細資料查詢、新增、更新與刪除等操作
import apiInstance from './instance';
import type { Employee } from '@/types/employee';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

// 查詢員工清單所需的參數
export interface EmployeeListParams {
  page?: number; // 目前頁碼
  pageSize?: number; // 每頁筆數
  keyword?: string; // 關鍵字搜尋
  groupId?: string; // 依所屬群組篩選
  area?: string; // 依地區篩選
  shift?: string; // 依班別篩選
  position?: string; // 依職位篩選
  license?: string; // 依證照類型篩選
}

// 新增或編輯員工時使用的表單資料結構
export interface EmployeeFormData {
  name: string; // 員工姓名
  phone: string; // 聯絡電話
  employeeNo: string; // 員工編號
  position: string; // 職位
  groupId: string; // 所屬群組 id
  groupName?: string; // 完整組別顯示名 (e.g., '台北早班')
  area?: string; // 地區 (e.g., '台北')
  shift?: string; // 班別 (e.g., '早班')
  leaveType?: string; // 休假類型 (REGULAR_LEAVE | ANNUAL_LEAVE | OTHER_LEAVE)
  designatedLeaves: string[]; // 指定休假日清單
  licenses: string[]; // 持有證照清單
}

export const employeeApi = {
  // 取得分頁員工清單
  list: (params: EmployeeListParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<PaginatedResponse<Employee>>>('/employees', { params, signal }),

  // 取得指定 id 的員工詳細資料
  detail: (id: string, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<Employee>>(`/employees/${id}`, { signal }),

  // 新增一筆員工資料
  create: (data: EmployeeFormData) => apiInstance.post<ApiResponse<Employee>>('/employees', data),

  // 更新指定 id 的員工資料（部分欄位更新）
  update: (id: string, data: Partial<EmployeeFormData>) =>
    apiInstance.patch<ApiResponse<Employee>>(`/employees/${id}`, data),

  // 刪除指定 id 的員工資料
  delete: (id: string) => apiInstance.delete<ApiResponse<null>>(`/employees/${id}`),
};
