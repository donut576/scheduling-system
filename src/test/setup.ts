/**
 * 全域測試環境設定檔（由 Vitest 的 setupFiles 載入）。
 * 用途：
 * - 設定 fast-check 的全域預設值（numRuns: 100+），作為未明確指定
 *   numRuns 的 property-based 測試的基準執行次數。
 * - 建立 MSW server 的生命週期（啟動／重設 handlers／關閉）。
 *   使用 onUnhandledRequest: 'bypass'，讓直接 mock query hook / axios
 *   的測試（本專案常見寫法）不會因未攔截到的請求而報錯。
 * - 確保每個測試結束後執行 RTL（React Testing Library）的 cleanup，
 *   並將語系重置回預設值 zh-TW，避免測試間互相污染。
 *
 * Validates: Requirements 17.1
 */
import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import fc from 'fast-check';
import { server } from './mocks/server';
import '@/i18n';
import i18n from '@/i18n';

// 設定 fast-check 全域預設執行次數，作為 property-based 測試的基準值
fc.configureGlobal({ numRuns: 100 });

// 所有測試開始前啟動 MSW server，攔截未被 mock 的請求時直接放行（bypass）
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

// 每個測試結束後：清除 DOM、重置語系為預設值、重置 MSW handlers
afterEach(() => {
  cleanup();
  void i18n.changeLanguage('zh-TW');
  server.resetHandlers();
});

// 所有測試結束後關閉 MSW server
afterAll(() => {
  server.close();
});
