// 身分驗證（Auth）相關 API 呼叫層
// 提供登入與取得個人資料的功能
import apiInstance from './instance';
import type { LoginRequest, LoginResponse, UserProfile } from '@/types/auth';
import type { ApiResponse } from '@/types/common';

export const authApi = {
  // 使用帳號密碼登入，回傳登入結果（含 Token 等資訊）
  login: (data: LoginRequest) => apiInstance.post<ApiResponse<LoginResponse>>('/auth/login', data),

  // 取得目前登入使用者的個人資料
  // signal: 用於取消請求的 AbortSignal
  getProfile: (signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<UserProfile>>('/auth/profile', { signal }),
};
