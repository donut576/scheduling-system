// instance.ts 的屬性測試（Property-Based Test）
// 驗證 Axios 請求攔截器附加 Bearer Token 的行為是否符合預期
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import apiInstance, { setTokenGetter } from './instance';

/**
 * Property 2: API 請求 Bearer Token 附加
 * Validates: Requirements 1.6, 19.4
 *
 * For any 有效 Token，Axios 實例發出之請求 Authorization 標頭格式為 `Bearer <token>`
 * When no token is present, no Authorization header is attached.
 */
describe('Property 2: API 請求 Bearer Token 附加', () => {
  beforeEach(() => {
    // Reset token getter to no-token state before each test
    // 每個測試前重設 Token 取得器為「無 Token」狀態，避免測試互相汙染
    setTokenGetter(() => null);
  });

  it('for any valid token string, request Authorization header is `Bearer <token>`', () => {
    /**
     * **Validates: Requirements 1.6, 19.4**
     */
    fc.assert(
      fc.property(
        // Generate non-empty token strings (valid tokens are non-empty)
        // 產生非空白的 Token 字串（有效 Token 應為非空字串）
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (token) => {
          // Set the token getter to return this token
          // 設定 Token 取得器回傳此次測試產生的 Token
          setTokenGetter(() => token);

          // Get the request interceptor handlers from Axios instance
          // We simulate a request config going through the interceptor
          // 模擬一個請求設定物件，準備讓它經過請求攔截器處理
          const config = {
            headers: new (
              apiInstance.defaults.headers.constructor as new () => Record<string, string>
            )(),
          };

          // Access the request interceptor directly
          // Axios interceptors are stored in an internal manager
          // 直接存取 Axios 內部管理的請求攔截器清單
          const interceptors = (
            apiInstance.interceptors.request as unknown as {
              handlers: Array<{ fulfilled: (config: unknown) => unknown }>;
            }
          ).handlers;
          const requestInterceptor = interceptors[0];
          if (!requestInterceptor) {
            throw new Error('Expected apiInstance to have a request interceptor registered');
          }

          // Run the interceptor's fulfilled handler
          // 執行攔截器的 fulfilled 處理函式，取得處理後的請求設定
          const result = requestInterceptor.fulfilled(config) as {
            headers: Record<string, string>;
          };

          // Verify the Authorization header matches `Bearer <token>` format
          // 驗證 Authorization 標頭是否符合 `Bearer <token>` 格式
          expect(result.headers.Authorization).toBe(`Bearer ${token}`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('when no token is present, no Authorization header is attached', () => {
    /**
     * **Validates: Requirements 1.6, 19.4**
     */
    fc.assert(
      fc.property(fc.constant(null), () => {
        // Set the token getter to return null (no token)
        // 設定 Token 取得器回傳 null，模擬無 Token 狀態
        setTokenGetter(() => null);

        const config = {
          headers: new (
            apiInstance.defaults.headers.constructor as new () => Record<string, string>
          )(),
        };

        const interceptors = (
          apiInstance.interceptors.request as unknown as {
            handlers: Array<{ fulfilled: (config: unknown) => unknown }>;
          }
        ).handlers;
        const requestInterceptor = interceptors[0];
        if (!requestInterceptor) {
          throw new Error('Expected apiInstance to have a request interceptor registered');
        }

        const result = requestInterceptor.fulfilled(config) as { headers: Record<string, string> };

        // When no token, Authorization header should not be set
        // 沒有 Token 時，Authorization 標頭應不存在
        expect(result.headers.Authorization).toBeUndefined();
      }),
      { numRuns: 1 },
    );
  });
});
