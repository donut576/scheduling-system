import type { TaskType, ShiftType, TaskContent, TaskAssignee, AlertStatus } from './task';

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

export interface ScheduleData {
  events: ScheduleEvent[];
  resources: ScheduleResource[];
}

export interface ScheduleResource {
  id: string;
  title: string;
  groupColor?: string;
  children?: ScheduleResource[];
}

export interface ScheduleParams {
  dimension: 'customer' | 'employee';
  startDate: string;
  endDate: string;
  groupId?: string;
  branchId?: string;
  employeeId?: string;
  areaId?: string;
}

export interface ScheduleFilters {
  groupId?: string;
  branchId?: string;
  employeeId?: string;
  areaId?: string;
}

export interface ScheduleChange {
  type: 'add' | 'update' | 'remove';
  eventId?: string;
  taskId: string;
  data?: Partial<ScheduleEvent>;
  previousData?: Partial<ScheduleEvent>;
}

export type ScheduleViewMode = 'day' | 'week' | 'month';
export type ScheduleDimension = 'customer' | 'employee';
