/**
 * 客戶相關型別定義
 *
 * 定義客戶（場域）、客戶群組/分店，以及待排時間客戶（尚未安排具體排班之客戶）之型別。
 */
import type { LicenseType } from './alert';
import type { RecurrenceRule, TaskType } from './task';

/** 客戶（服務場域）資料 */
export interface Customer {
  id: string;
  groupId: string;
  groupName: string;
  branchId: string;
  branchName: string;
  /** 縣市（與行政區一起決定所屬群組） */
  city?: string;
  /** 行政區 */
  district?: string;
  /** 依縣市＋行政區算出的所屬群組名稱（北早、北一晚…），由後端提供 */
  regions?: string[];
  address: string;
  latitude?: number;
  longitude?: number;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  backupName?: string;
  backupPhone?: string;
  backupEmail?: string;
  requiredLicenses: LicenseType[];
  licenseRestrictionNote?: string;
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
  city?: string;
  district?: string;
  regions?: string[];
  address: string;
  latitude?: number;
  longitude?: number;
  contactName: string;
  contactPhone: string;
  requiredLicenses: LicenseType[];
  licenseRestrictionNote?: string;
}

/** 待排時間客戶：尚未確定具體排班時間之客戶需求 */
export interface PendingCustomer {
  id: string;
  groupId: string;
  groupName: string;
  branchId: string;
  branchName: string;
  taskType?: TaskType;
  status: PendingCustomerStatus;
  date?: string;
  startTime?: string;
  endTime?: string;
  isOvernight?: boolean;
  headcount: number;
  shift?: string;
  route?: string;
  contents?: string[];
  otherContentNote?: string;
  assignees?: { employeeId: string; employeeName: string }[];
  recurrenceRule?: RecurrenceRule;
  isRecurring?: boolean;
  remarks?: string;
  /** 副總駁回原因（回待排區後顯示，重新排班後清除） */
  rejectReason?: string;
  /** 駁回時被移除的指派人員姓名 */
  rejectedAssignees?: string;
  createdAt: string;
  updatedAt: string;
}

/** 待排時間客戶狀態：待處理／已確認／已轉換為正式任務 */
export type PendingCustomerStatus = 'PENDING' | 'CONFIRMED' | 'CONVERTED';
