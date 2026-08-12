/**
 * 排班檢視相關型別定義
 *
 * 定義排班日曆事件（ScheduleEvent）、資源（ScheduleResource，如客戶或員工列）、
 * 查詢參數/篩選條件，以及排班變更、檢視模式與檢視維度等型別。
 */
import type { TaskType, ShiftType, TaskContent, TaskAssignee, AlertStatus } from './task';

/** 排班日曆上的單一事件（對應一筆任務排班） */
export interface ScheduleEvent {
  id: string;
  taskId: string;
  resourceId: string;
  title: string;
  start: string;
  end: string;
  groupName: string;
  branchName: string;
  alertStatus: AlertStatus;
  isRecurring: boolean;
  isOvernight: boolean;
  backgroundColor?: string;
  borderColor?: string;
  extendedProps: {
    taskType: TaskType;
    shift: ShiftType;
    assignees: TaskAssignee[];
    contents: TaskContent[];
  };
}

/** 排班日曆整體資料（事件清單與資源列） */
export interface ScheduleData {
  events: ScheduleEvent[];
  resources: ScheduleResource[];
}

/** 排班日曆資源列（依維度可為客戶或員工，支援巢狀 children） */
export interface ScheduleResource {
  id: string;
  title: string;
  groupColor?: string;
  children?: ScheduleResource[];
}

/** 排班查詢參數 */
export interface ScheduleParams {
  dimension: 'customer' | 'employee';
  startDate: string;
  endDate: string;
  groupId?: string;
  branchId?: string;
  employeeId?: string;
  areaId?: string;
}

/** 排班篩選條件 */
export interface ScheduleFilters {
  groupId?: string;
  branchId?: string;
  employeeId?: string;
  areaId?: string;
}

/** 單筆排班變更記錄（新增／更新／移除），供變更緩衝區與復原機制使用 */
export interface ScheduleChange {
  type: 'add' | 'update' | 'remove';
  eventId?: string;
  taskId: string;
  data?: Partial<ScheduleEvent>;
  previousData?: Partial<ScheduleEvent>;
}

/** 排班檢視模式：日／週／月 */
export type ScheduleViewMode = 'day' | 'week' | 'month';
/** 排班檢視維度：依客戶或依員工 */
export type ScheduleDimension = 'customer' | 'employee';
