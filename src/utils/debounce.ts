/**
 * 防抖動 (Debounce) 工具模組。
 *
 * 提供通用防抖動函式與對應 React Hook，用於延遲執行高頻觸發之操作
 * （例如即時輸入驗證、搜尋請求），避免短時間內重複呼叫。
 * 另提供 AbortController 管理 Hook，用於取消前一次尚未完成之非同步請求。
 */
import { useCallback, useEffect, useRef } from 'react';

/**
 * 通用防抖動函式。
 * 每次呼叫回傳的函式時，會取消前一次尚未執行之計時器並重新計時，
 * 只有在最後一次呼叫後經過 delay 毫秒且沒有新呼叫時，才會真正執行 fn。
 *
 * @param fn 欲進行防抖動包裝之原始函式
 * @param delay 延遲時間（毫秒）
 * @returns 防抖動後的函式，並附帶 cancel() 方法可主動取消待執行之呼叫
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    // 每次呼叫先清除前一個尚未觸發的計時器，重新開始倒數
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
};

/**
 * 提供防抖動回呼函式之 React Hook。
 * 預設延遲 200ms（依規格用於即時驗證情境）。
 * 使用 ref 保存最新的 callback，避免因閉包造成呼叫到過期的函式版本；
 * 元件卸載時會自動清除尚未觸發的計時器。
 *
 * @param callback 欲防抖動之回呼函式
 * @param delay 延遲時間（毫秒），預設 200ms
 * @returns 防抖動後可供呼叫的函式
 */
export const useDebouncedCallback = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay = 200,
): ((...args: Parameters<T>) => void) => {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  );
};

/**
 * 管理 AbortController 之 React Hook。
 * 每次呼叫回傳的函式時，會先中止（abort）前一個尚未完成的請求，
 * 再建立新的 AbortController 並回傳其 signal，
 * 用於避免快速連續觸發時，舊的非同步請求結果覆蓋新的請求結果（競態問題）。
 *
 * @returns 取得新 AbortSignal 的函式；每次呼叫皆會取消前一次的請求
 */
export const useAbortController = (): (() => AbortSignal) => {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return useCallback(() => {
    // 取消前一次尚未完成的請求
    controllerRef.current?.abort();
    // 建立新的 AbortController 供本次請求使用
    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  }, []);
};
