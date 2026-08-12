import apiInstance from './instance';
import type { Employee } from '@/types/employee';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

export interface EmployeeListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  groupId?: string;
  position?: string;
  license?: string;
}

export interface EmployeeFormData {
  name: string;
  phone: string;
  employeeNo: string;
  position: string;
  groupId: string;
  designatedLeaves: string[];
  licenses: string[];
}

export const employeeApi = {
  list: (params: EmployeeListParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<PaginatedResponse<Employee>>>('/employees', { params, signal }),

  detail: (id: string, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<Employee>>(`/employees/${id}`, { signal }),

  create: (data: EmployeeFormData) => apiInstance.post<ApiResponse<Employee>>('/employees', data),

  update: (id: string, data: Partial<EmployeeFormData>) =>
    apiInstance.patch<ApiResponse<Employee>>(`/employees/${id}`, data),
};
