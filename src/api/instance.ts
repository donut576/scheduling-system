// 共用 Axios 實例設定
// 統一處理請求 Token 附加、回應錯誤攔截與全域錯誤訊息提示
import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { ERROR_MESSAGES } from '@/constants/errorCodes';
import type { ApiResponse } from '@/types/common';

// Create Axios instance
// 建立 Axios 實例，設定基礎路徑、逾時時間與預設標頭
const apiInstance = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || '') + '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
  },
});

// Token getter - will be replaced by store integration in Task 3
// Token 取得器與未授權處理器，預設為空實作，實際邏輯會在應用初始化時透過下方 setter 注入（例如與狀態管理 store 整合）
let getToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

// 設定取得 Token 的函式（由外部注入，通常來自登入狀態管理）
export const setTokenGetter = (getter: () => string | null) => {
  getToken = getter;
};

// 設定收到 401 未授權回應時要執行的處理函式（例如導向登入頁）
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

// Request interceptor: attach Bearer Token
// 請求攔截器：若有 Token，自動附加 Authorization 標頭
apiInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: handle errors globally
// 回應攔截器：統一處理業務錯誤碼與 HTTP 錯誤狀態
apiInstance.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>) => {
    const data = response.data;
    // Check business error code
    // 檢查業務邏輯錯誤碼（非 HTTP 狀態碼），非 0 表示業務層發生錯誤
    if (data.code !== 0) {
      const errorMsg = ERROR_MESSAGES[data.code] || data.message || '未知錯誤';
      message.error(errorMsg);
      return Promise.reject(new Error(errorMsg));
    }
    return response;
  },
  (error: AxiosError<ApiResponse<unknown>>) => {
    if (error.code === 'ERR_CANCELED') {
      // Request was cancelled via AbortController - no error display
      // 請求被主動取消（透過 AbortController），不顯示錯誤訊息
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const data = error.response?.data;

    // 依 HTTP 狀態碼顯示對應的錯誤訊息
    switch (status) {
      case 401:
        message.error('登入已過期，請重新登入');
        onUnauthorized();
        break;
      case 403:
        message.error('無此操作權限');
        break;
      case 422: {
        // Validation errors - let the caller handle field-level errors
        // 資料驗證錯誤：僅顯示全域訊息，欄位層級的錯誤交由呼叫端自行處理
        const errorMsg = data?.message || '資料驗證失敗';
        message.error(errorMsg);
        break;
      }
      case 429:
        message.warning('請求過於頻繁，請稍後再試');
        break;
      default:
        if (status && status >= 500) {
          message.error('伺服器錯誤，請稍後再試');
        } else if (!error.response) {
          // 沒有 response 表示請求根本沒有送達伺服器，通常是網路問題
          message.error('網路連線異常，請檢查網路');
        }
    }

    return Promise.reject(error);
  },
);

// Helper function to handle API errors in catch blocks
// 輔助函式：在 catch 區塊中統一解析錯誤訊息，回傳可顯示的錯誤字串
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiResponse<unknown> | undefined;
    return data?.message || error.message || '未知錯誤';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '未知錯誤';
};

export default apiInstance;
