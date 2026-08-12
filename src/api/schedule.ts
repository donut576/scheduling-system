import apiInstance from './instance';
import type { ScheduleData, ScheduleParams } from '@/types/schedule';
import type { ApiResponse } from '@/types/common';

export interface ScheduleUpdateData {
  changes: Array<{
    type: 'add' | 'update' | 'remove';
    taskId: string;
    data?: Record<string, unknown>;
  }>;
}

export const scheduleApi = {
  get: (params: ScheduleParams, signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<ScheduleData>>('/schedule', { params, signal }),

  update: (data: ScheduleUpdateData) => apiInstance.patch<ApiResponse<null>>('/schedule', data),
};
