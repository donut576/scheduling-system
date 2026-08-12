export interface LoginRequest {
  account: string;
  password: string;
  captcha?: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: UserProfile;
}

export interface UserProfile {
  id: string;
  name: string;
  employeeNo: string;
  role: RoleType;
  permissions: string[];
  groupId?: string;
}

export type RoleType =
  'ADMIN' | 'ADMIN_STAFF' | 'MANAGER' | 'DIRECTOR' | 'LEADER' | 'STAFF' | 'SALES_OPS';
