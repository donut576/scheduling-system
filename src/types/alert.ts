/**
 * 警示規則（Alert）相關型別定義
 *
 * 定義證照類型、警示規則識別碼、警示嚴重程度，以及排班/任務驗證所需之
 * 上下文與驗證結果型別，供警示引擎（alert rules）在建立/編輯任務時使用。
 */
import type { TaskFormData } from './task';
import type { Employee } from './employee';
import type { Task } from './task';

/** 證照類型（員工可持有、客戶場域可要求） */
export type LicenseType =
  | 'NONE'
  | 'PROFESSIONAL'
  | 'PEST_CONTROL'
  | 'FIRE_ANT'
  | 'SAFETY_6HR'
  | 'SAFETY_MANAGER_A'
  | 'SAFETY_MANAGER_B'
  | 'SAFETY_MANAGER_C';

/** 警示規則識別碼（每種規則對應一種排班/任務問題檢查） */
export type AlertRuleId =
  | 'LICENSE_REQUIRED'
  | 'CONSECUTIVE_DAYS'
  | 'DAILY_HOURS_EXCEEDED'
  | 'DUPLICATE_SLOT'
  | 'DESIGNATED_LEAVE'
  | 'HEADCOUNT_BELOW_MIN';

/** 警示嚴重程度：阻擋（不可送出）／警告（可覆蓋送出）／提示 */
export type AlertSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

/** 單筆警示違規結果 */
export interface AlertViolation {
  ruleId: AlertRuleId;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown>;
  affectedEmployees?: string[];
}

/** 整體警示驗證結果（彙整所有規則檢查後的結論） */
export interface AlertValidationResult {
  isValid: boolean;
  violations: AlertViolation[];
  canOverride: boolean;
}

/** 單一警示規則檢查函式簽名：輸入任務表單與上下文，回傳違規結果或 null */
export type AlertRuleChecker = (task: TaskFormData, context: AlertContext) => AlertViolation | null;

/** 警示規則檢查所需之上下文資料（員工、既有任務、客戶證照要求、國定假日） */
export interface AlertContext {
  employees: Employee[];
  existingTasks: Task[];
  customerLicenses: LicenseType[];
  holidays: string[];
}
