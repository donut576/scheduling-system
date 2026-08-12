/**
 * queryClient.ts 的單元測試，驗證全域 QueryClient 的預設設定值
 * （重試次數、重試延遲策略、快取存活時間等）是否正確。
 */
import { describe, it, expect } from 'vitest';
import { queryClient } from './queryClient';

describe('queryClient', () => {
  it('configures queries with retry 3', () => {
    // 驗證查詢的預設重試次數為 3
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(3);
  });

  it('configures queries with exponential backoff retryDelay', () => {
    // 驗證重試延遲時間會依指數退避策略遞增，並在 30000ms 時封頂
    const defaults = queryClient.getDefaultOptions();
    const retryDelay = defaults.queries?.retryDelay as (attempt: number) => number;
    expect(retryDelay(0)).toBe(1000); // 1000 * 2^0 = 1000
    expect(retryDelay(1)).toBe(2000); // 1000 * 2^1 = 2000
    expect(retryDelay(2)).toBe(4000); // 1000 * 2^2 = 4000
    expect(retryDelay(3)).toBe(8000); // 1000 * 2^3 = 8000
    expect(retryDelay(10)).toBe(30000); // 已達上限 30000
  });

  it('configures queries with staleTime of 5 minutes', () => {
    // 驗證資料的「新鮮」時間為 5 分鐘
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(5 * 60 * 1000);
  });

  it('configures queries with gcTime of 10 minutes', () => {
    // 驗證快取的垃圾回收時間為 10 分鐘
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.gcTime).toBe(10 * 60 * 1000);
  });

  it('disables refetchOnWindowFocus', () => {
    // 驗證視窗重新取得焦點時不會自動重新查詢
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('configures mutations with retry 0', () => {
    // 驗證變更操作預設不重試
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.mutations?.retry).toBe(0);
  });

  it('configures mutations with global onError handler', () => {
    // 驗證變更操作有設定全域錯誤處理函式
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.mutations?.onError).toBeDefined();
    expect(typeof defaults.mutations?.onError).toBe('function');
  });
});
