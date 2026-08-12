/**
 * 任務相關型別定義
 *
 * 定義任務（Task）本體、任務表單資料、指派人員、查詢參數，以及任務類型、
 * 狀態、警示狀態、班次、任務內容與重複規則等型別。
 */
import type { LicenseType } from './alert';

/** 任務（單筆排班/服務工作） */
export interface Task {
  id: string;
  groupId: string;
  groupName: string;
  branchId: string;
  branchName: string;
  taskType: TaskType;
  date: string;
  startTime: string;
  endTime: string;
  isOvernight: boolean;
  headcount: number;
  shift: ShiftType;
  route: string;
  contents: TaskContent[];
  otherContentNote?: string;
  assignees: TaskAssignee[];
  remarks?: string;
  recurrenceId?: string;
  recurrenceRule?: RecurrenceRule;
  status: TaskStatus;
  alertStatus: AlertStatus;
  overrideRemark?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 任務表單資料（建立/編輯任務時使用，指派人員以 ID 陣列表示） */
export interface TaskFormData {
  groupId: string;
  branchId: string;
  taskType: TaskType;
  date: string;
  startTime: string;
  endTime: string;
  headcount: number;
  shift: ShiftType;
  route: string;
  contents: TaskContent[];
  otherContentNote?: string;
  assignees: string[];
  remarks?: string;
  recurrence?: RecurrenceRule;
}

/** 任務指派人員（含姓名與持有證照，供顯示與警示規則檢查使用） */
export interface TaskAssignee {
  employeeId: string;
  employeeName: string;
  licenses: LicenseType[];
}

/** 任務列表查詢參數 */
export interface TaskListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  groupId?: string;
  branchId?: string;
  taskType?: TaskType;
  status?: TaskStatus;
  startDate?: string;
  endDate?: string;
}

/** 任務類型：合約／單次／ESR */
export type TaskType = 'CONTRACT' | 'ONETIME' | 'ESR';
/** 任務狀態：未排班／已排班／已更改／已確認／待核准／已取消 */
export type TaskStatus =
  'UNSCHEDULED' | 'SCHEDULED' | 'MODIFIED' | 'CONFIRMED' | 'PENDING_APPROVAL' | 'CANCELLED';
/** 警示狀態：無警示／有違規／已覆蓋 */
export type AlertStatus = 'CLEAN' | 'VIOLATED' | 'OVERRIDDEN';
/** 班次類型（由後端動態提供，例如 '台北早班'、'台北晚班'） */
export type ShiftType = string; // Dynamic from backend (e.g., '台北早班', '台北晚班')
/** 任務內容項目（服務項目代碼） */
export type TaskContent =
  | 'P'
  | 'R'
  | 'S'
  | 'TERMITE'
  | 'FIRE_ANT'
  | 'BED_BUG'
  | 'VEHICLE_MAINTENANCE'
  | 'TRAINING'
  | 'OTHER';

/** 重複規則（用於定期任務，如每日/每週/每月/自訂重複） */
export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endType: 'never' | 'date' | 'count';
  endDate?: string;
  endCount?: number;
}
