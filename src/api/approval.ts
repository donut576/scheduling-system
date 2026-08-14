// 審核（Approval）相關 API 呼叫層
// 提供審核清單查詢、核准與拒絕等操作
import apiInstance from './instance';
import type { Approval } from '@/types/notification';
import type { ApiResponse, PaginatedResponse } from '@/types/common';

// 查詢審核清單所需的參數
export interface ApprovalListParams {
  page?: number; // 目前頁碼
  pageSize?: number; // 每頁筆數
  status?: string; // 審核狀態篩選條件
  type?: string; // 審核類型篩選條件
}

export const approvalApi = {
  // 取得分頁審核清單
  // params: 查詢條件（頁碼、每頁筆數、狀態）
  // signal: 用於取消請求的 AbortSignal
  list: (params: ApprovalListParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<PaginatedResponse<Approval>>>('/approvals', { params, signal }),

  // 核准指定 id 的審核項目，可附帶備註
  approve: (id: string, comment?: string) =>
    apiInstance.post<ApiResponse<null>>(`/approvals/${id}/approve`, { comment }),

  // 拒絕指定 id 的審核項目，需附帶拒絕原因
  reject: (id: string, comment: string) =>
    apiInstance.post<ApiResponse<null>>(`/approvals/${id}/reject`, { comment }),
};
