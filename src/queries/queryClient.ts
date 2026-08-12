/**
 * React Query 的全域 QueryClient 設定檔。
 * 統一管理查詢（query）與變更（mutation）的預設行為，
 * 例如重試策略、快取存活時間，以及全域錯誤處理。
 */
import { QueryClient } from '@tanstack/react-query';
import { handleApiError } from '@/api/instance';

// 匯出的全域單一 QueryClient 實例，供 QueryClientProvider 使用
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 查詢失敗時最多重試 3 次
      retry: 3,
      // 重試延遲採用指數退避（exponential backoff）策略，
      // 每次重試間隔加倍，並以 30 秒為上限，避免無限延長等待時間
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 資料視為「新鮮」的時間：5 分鐘，期間內不會自動重新請求
      gcTime: 10 * 60 * 1000, // 快取資料在無人訂閱後的保留時間：10 分鐘，超過後會被垃圾回收
      refetchOnWindowFocus: false, // 停用「視窗重新取得焦點時自動重新查詢」，避免不必要的請求
    },
    mutations: {
      // 變更操作（新增/更新/刪除）失敗時不自動重試，避免重複送出造成副作用
      retry: 0,
      // 全域的變更錯誤處理，統一交由 handleApiError 處理（例如顯示錯誤訊息）
      onError: (error) => {
        handleApiError(error);
      },
    },
  },
});
