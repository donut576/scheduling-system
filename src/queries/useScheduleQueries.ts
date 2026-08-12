/**
 * 排班（Schedule）相關的 React Query hooks。
 * 提供排班資料查詢，以及批次更新排班（新增/更新/移除事件）的變更操作。
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scheduleApi } from '@/api/schedule';
import type { ScheduleUpdateData } from '@/api/schedule';
import type { ScheduleData, ScheduleParams } from '@/types/schedule';
import { taskKeys } from './useTaskQueries';

// 排班相關查詢的 query key 工廠函式，統一管理快取鍵值結構
export const scheduleKeys = {
  all: ['schedule'] as const,
  // 依照維度（客戶/員工）、日期範圍與篩選參數產生不同的快取鍵
  data: (params: ScheduleParams) => [...scheduleKeys.all, params] as const,
};

/**
 * 取得排班資料的 hook，支援維度（dimension）、日期範圍（dateRange）、
 * 篩選條件與 AbortSignal（可中斷請求）。
 * 同時支援「依客戶」與「依員工」兩種檢視維度。
 *
 * Validates: Requirements 8.7, 17.5
 */
export function useScheduleData(params: ScheduleParams) {
  return useQuery<ScheduleData>({
    queryKey: scheduleKeys.data(params),
    queryFn: async ({ signal }) => {
      const response = await scheduleApi.get(params, signal);
      return response.data.data;
    },
  });
}

/**
 * 更新排班的變更（mutation）hook（批次變更：新增/更新/移除事件）。
 * 因為排班變更也會影響任務資料，成功後需同時讓排班快取與
 * 任務列表快取失效，確保兩邊資料都能反映最新狀態。
 */
export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ScheduleUpdateData>({
    mutationFn: async (data) => {
      await scheduleApi.update(data);
    },
    onSuccess: () => {
      // 排班變更後同時讓排班與任務相關快取失效
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
