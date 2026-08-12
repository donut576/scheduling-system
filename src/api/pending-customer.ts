import apiInstance from './instance';
import type { PendingCustomer } from '@/types/customer';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

export interface PendingCustomerListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  groupId?: string;
}

export interface PendingCustomerFormData {
  groupId: string;
  branchId: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  headcount: number;
  shift?: string;
  remarks?: string;
}

export interface ConvertToTaskData {
  date: string;
  startTime: string;
  endTime: string;
  shift: string;
  headcount: number;
}

export const pendingCustomerApi = {
  list: (params: PendingCustomerListParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<PaginatedResponse<PendingCustomer>>>('/pending-customers', {
      params,
      signal,
    }),

  create: (data: PendingCustomerFormData) =>
    apiInstance.post<ApiResponse<PendingCustomer>>('/pending-customers', data),

  update: (id: string, data: Partial<PendingCustomerFormData>) =>
    apiInstance.patch<ApiResponse<PendingCustomer>>(`/pending-customers/${id}`, data),

  convert: (id: string, data: ConvertToTaskData) =>
    apiInstance.post<ApiResponse<null>>(`/pending-customers/${id}/convert`, data),
};
