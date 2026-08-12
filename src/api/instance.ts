import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { message } from 'antd';
import { ERROR_MESSAGES } from '@/constants/errorCodes';
import type { ApiResponse } from '@/types/common';

// Create Axios instance
const apiInstance = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL || '') + '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
  },
});

// Token getter - will be replaced by store integration in Task 3
let getToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

export const setTokenGetter = (getter: () => string | null) => {
  getToken = getter;
};

export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

// Request interceptor: attach Bearer Token
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
apiInstance.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>) => {
    const data = response.data;
    // Check business error code
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
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const data = error.response?.data;

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
          message.error('網路連線異常，請檢查網路');
        }
    }

    return Promise.reject(error);
  },
);

// Helper function to handle API errors in catch blocks
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
