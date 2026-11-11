/**
 * 登入驗證相關型別定義
 *
 * 定義登入請求/回應格式、使用者個人資料，以及系統中五種角色類型。
 */

/** 登入請求參數 */
export interface LoginRequest {
  account: string;
  password: string;
  captcha?: string;
  rememberMe?: boolean;
}

/** 登入成功後之回應內容 */
export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: UserProfile;
}

/** 使用者個人資料 */
export interface UserProfile {
  id: string;
  name: string;
  employeeNo: string;
  role: RoleType;
  permissions: string[];
  groupId?: string;
  area?: string;
  /** 是否需要先變更密碼（使用預設密碼或被管理員重設）；true 時登入後會跳出強制改密碼視窗 */
  mustChangePassword?: boolean;
}

/** 變更密碼請求參數 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** 使用者角色類型：管理員／行政／經理／組長／一般員工 */
export type RoleType = 'ADMIN' | 'ADMIN_STAFF' | 'MANAGER' | 'LEADER' | 'STAFF';

/** 忘記密碼（寄信重設）請求參數 */
export interface ForgotPasswordRequest {
  account: string;
}

/** 用信件連結設定新密碼的請求參數 */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}
