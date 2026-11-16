/**
 * 儀表板通知卡片用的資料型別。
 * 目前後端尚未提供 payload，先由 MSW mock 帶；後端實作時 Notification 回傳此欄位即可。
 */
import type { Notification } from '@/types/notification';

export type TaskChangeField = 'date' | 'time' | 'timeRemark' | 'location' | 'contents' | 'remarks';

/** 員工「近期任務異動」：新增／修改／取消任務 */
export interface TaskChangePayload {
  kind: 'TASK_CHANGE';
  groupName: string;
  branchName: string;
  /** 任務類型：CONTRACT 合約／ONETIME 單次／ESR */
  taskType?: string;
  /** YYYY-MM-DD */
  date: string;
  /** 固定時間 HHmm；彈性任務請設 flexible */
  time?: string;
  flexible?: boolean;
  /** 彈性任務的說明（通常是彈性的原因，自由填寫） */
  timeRemark?: string;
  address?: string;
  contents: string[];
  remarks?: string;
  /** 施作同仁（詳細視窗顯示；與任務詳細的「施作同仁」同一區塊） */
  assignees?: { employeeId: string; employeeName: string }[];
  /** 修改任務時，被修改的欄位（詳細視窗只標這些） */
  changedFields?: TaskChangeField[];
  /** 修改任務時，被修改欄位的「原本內容」（詳細視窗用淺灰＋刪除線顯示在新值下方） */
  previous?: {
    date?: string;
    time?: string;
    flexible?: boolean;
    timeRemark?: string;
    address?: string;
    contents?: string[];
    remarks?: string;
  };
}

/** 發送紀錄（郵件）所屬的任務資訊：列表用日期塊＋時間＋新增／修改／取消 */
export interface SendLogPayload {
  kind: 'SEND_LOG';
  action: 'CREATED' | 'UPDATED' | 'CANCELED';
  /** 任務日期 YYYY-MM-DD、固定時間 HHmm（彈性任務設 flexible） */
  taskDate: string;
  taskTime?: string;
  flexible?: boolean;
}

/** 審核結果（主任系統通知） */
export interface ApprovalResultPayload {
  kind: 'APPROVAL_RESULT';
  result: 'APPROVED' | 'REJECTED';
  applyContent: string;
  target: string;
  taskText: string;
  /** 列表第二行用：任務日期 YYYY-MM-DD、固定時間 HHmm（彈性任務設 flexible）、集團與分店 */
  taskDate?: string;
  taskTime?: string;
  flexible?: boolean;
  groupName?: string;
  branchName?: string;
  reviewer: string;
  reason?: string;
}

/** 證照即將到期（主任系統通知） */
export interface LicenseExpiryPayload {
  kind: 'LICENSE_EXPIRY';
  employeeName: string;
  license: string;
  /** YYYY-MM-DD */
  expiryDate: string;
  daysLeft: number;
}

export type NotificationPayload =
  TaskChangePayload | ApprovalResultPayload | LicenseExpiryPayload | SendLogPayload;

export type DashboardNotification = Notification & {
  payload?: NotificationPayload;
  /** 發送紀錄用：收件者所屬轄區（證照信給主任時顯示） */
  recipientArea?: string;
};
