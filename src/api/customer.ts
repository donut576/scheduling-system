import apiInstance from './instance';
import type { Customer, CustomerGroup } from '@/types/customer';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

export interface CustomerListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  groupId?: string;
}

export interface CustomerFormData {
  groupName: string;
  branchName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  contactName: string;
  contactPhone: string;
  requiredLicenses: string[];
  remarks?: string;
}

export const customerApi = {
  list: (params: CustomerListParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<PaginatedResponse<Customer>>>('/customers', { params, signal }),

  groups: (signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<CustomerGroup[]>>('/customers/groups', { signal }),

  create: (data: CustomerFormData) => apiInstance.post<ApiResponse<Customer>>('/customers', data),

  update: (id: string, data: Partial<CustomerFormData>) =>
    apiInstance.patch<ApiResponse<Customer>>(`/customers/${id}`, data),

  delete: (id: string) => apiInstance.delete<ApiResponse<null>>(`/customers/${id}`),
};
