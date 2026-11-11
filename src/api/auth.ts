// 身分驗證（Auth）相關 API 呼叫層
// 提供登入與取得個人資料的功能
import apiInstance from './instance';
import type {
  LoginRequest,
  LoginResponse,
  UserProfile,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '@/types/auth';
import type { ApiResponse } from '@/types/common';

export const authApi = {
  // 使用帳號密碼登入，回傳登入結果（含 Token 等資訊）
  login: (data: LoginRequest) => apiInstance.post<ApiResponse<LoginResponse>>('/auth/login', data),

  // 取得目前登入使用者的個人資料
  // signal: 用於取消請求的 AbortSignal
  getProfile: (signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<UserProfile>>('/auth/profile', { signal }),

  // 變更自己的密碼（首次登入被要求改密碼時也用這支）
  changePassword: (data: ChangePasswordRequest) =>
    apiInstance.post<ApiResponse<null>>('/auth/change-password', data),

  // 忘記密碼：寄重設信到員工信箱（不論帳號是否存在都回成功）
  forgotPassword: (data: ForgotPasswordRequest) =>
    apiInstance.post<ApiResponse<null>>('/auth/forgot-password', data),

  // 開啟信件連結時，先確認連結是否有效，並取得員工編號
  checkResetToken: (token: string) =>
    apiInstance.get<ApiResponse<{ employeeNo: string }>>('/auth/reset-password/check', {
      params: { token },
    }),

  // 用信件連結設定新密碼
  resetPassword: (data: ResetPasswordRequest) =>
    apiInstance.post<ApiResponse<null>>('/auth/reset-password', data),
};
