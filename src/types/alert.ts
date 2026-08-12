import type { TaskFormData } from './task';
import type { Employee } from './employee';
import type { Task } from './task';

export type LicenseType =
  | 'NONE'
  | 'PROFESSIONAL'
  | 'PEST_CONTROL'
  | 'FIRE_ANT'
  | 'SAFETY_6HR'
  | 'SAFETY_MANAGER_A'
  | 'SAFETY_MANAGER_B'
  | 'SAFETY_MANAGER_C';

export type AlertRuleId =
  | 'LICENSE_REQUIRED'
  | 'CONSECUTIVE_DAYS'
  | 'DAILY_HOURS_EXCEEDED'
  | 'DUPLICATE_SLOT'
  | 'DESIGNATED_LEAVE'
  | 'HEADCOUNT_BELOW_MIN';

export type AlertSeverity = 'BLOCKING' | 'WARNING' | 'INFO';

export interface AlertViolation {
  ruleId: AlertRuleId;
  severity: AlertSeverity;
  message: string;
  details: Record<string, unknown>;
  affectedEmployees?: string[];
}

export interface AlertValidationResult {
  isValid: boolean;
  violations: AlertViolation[];
  canOverride: boolean;
}

export type AlertRuleChecker = (task: TaskFormData, context: AlertContext) => AlertViolation | null;

export interface AlertContext {
  employees: Employee[];
  existingTasks: Task[];
  customerLicenses: LicenseType[];
  holidays: string[];
}
