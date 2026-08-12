// 排班（Schedule）相關 API 呼叫層
// 提供排班資料查詢與更新（新增/修改/移除任務）等操作
import apiInstance from './instance';
import type { ScheduleData, ScheduleParams } from '@/types/schedule';
import type { ApiResponse } from '@/types/common';

// 更新排班時使用的資料結構，包含一批變更項目
export interface ScheduleUpdateData {
  changes: Array<{
    type: 'add' | 'update' | 'remove'; // 變更類型：新增、更新或移除
    taskId: string; // 對應的任務 id
    data?: Record<string, unknown>; // 變更內容（新增/更新時使用）
  }>;
}

export const scheduleApi = {
  // 取得排班資料
  // params: 查詢條件（例如日期範圍等）
  get: (params: ScheduleParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<ScheduleData>>('/schedule', { params, signal }),

  // 更新排班資料，可一次送出多筆變更
  update: (data: ScheduleUpdateData) => apiInstance.patch<ApiResponse<null>>('/schedule', data),
};
