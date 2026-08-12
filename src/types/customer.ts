/**
 * 客戶相關型別定義
 *
 * 定義客戶（場域）、客戶群組/分店，以及待排時間客戶（尚未安排具體排班之客戶）之型別。
 */
import type { LicenseType } from './alert';

/** 客戶（服務場域）資料 */
export interface Customer {
  id: string;
  groupId: string;
  groupName: string;
  branchId: string;
  branchName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  contactName: string;
  contactPhone: string;
  requiredLicenses: LicenseType[];
  remarks?: string;
}

/** 客戶群組（可包含多個分店/場域） */
export interface CustomerGroup {
  id: string;
  name: string;
  branches: CustomerBranch[];
}

/** 客戶分店/場域 */
export interface CustomerBranch {
  id: string;
  groupId: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  contactName: string;
  contactPhone: string;
  requiredLicenses: LicenseType[];
}

/** 待排時間客戶：尚未確定具體排班時間之客戶需求 */
export interface PendingCustomer {
  id: string;
  groupId: string;
  groupName: string;
  branchId: string;
  branchName: string;
  status: PendingCustomerStatus;
  date?: string;
  startTime?: string;
  endTime?: string;
  headcount: number;
  shift?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

/** 待排時間客戶狀態：待處理／已確認／已轉換為正式任務 */
export type PendingCustomerStatus = 'PENDING' | 'CONFIRMED' | 'CONVERTED';
