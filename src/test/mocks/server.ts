/**
 * Node.js（測試）環境下的 MSW server 設定檔。
 * 用於在 Vitest 測試執行期間攔截 HTTP 請求並回傳 mock 資料。
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW server instance used to intercept HTTP requests during tests.
 *
 * Validates: Requirements 17.1
 */
export const server = setupServer(...handlers);
