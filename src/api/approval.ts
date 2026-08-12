import apiInstance from './instance';
import type { Approval } from '@/types/notification';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

export interface ApprovalListParams {
  page?: number;
  pageSize?: number;
  status?: string;
}

export const approvalApi = {
  list: (params: ApprovalListParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<PaginatedResponse<Approval>>>('/approvals', { params, signal }),

  approve: (id: string, comment?: string) =>
    apiInstance.post<ApiResponse<null>>(`/approvals/${id}/approve`, { comment }),

  reject: (id: string, comment: string) =>
    apiInstance.post<ApiResponse<null>>(`/approvals/${id}/reject`, { comment }),
};
