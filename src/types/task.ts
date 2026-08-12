import type { LicenseType } from './alert';

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

export interface TaskAssignee {
  employeeId: string;
  employeeName: string;
  licenses: LicenseType[];
}

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

export type TaskType = 'CONTRACT' | 'ONETIME' | 'ESR';
export type TaskStatus =
  'UNSCHEDULED' | 'SCHEDULED' | 'MODIFIED' | 'CONFIRMED' | 'PENDING_APPROVAL' | 'CANCELLED';
export type AlertStatus = 'CLEAN' | 'VIOLATED' | 'OVERRIDDEN';
export type ShiftType = string; // Dynamic from backend (e.g., '台北早班', '台北晚班')
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

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endType: 'never' | 'date' | 'count';
  endDate?: string;
  endCount?: number;
}
