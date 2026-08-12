import apiInstance from './instance';
import type { LoginRequest, LoginResponse, UserProfile } from '@/types/auth';
import type { ApiResponse } from '@/types/common';

export const authApi = {
  login: (data: LoginRequest) => apiInstance.post<ApiResponse<LoginResponse>>('/auth/login', data),

  getProfile: (signal?: AbortSignal) =>
    apiInstance.get<ApiResponse<UserProfile>>('/auth/profile', { signal }),
};
