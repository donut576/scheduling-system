/**
 * 通知與特許核准相關型別定義
 *
 * 定義通知（Notification）、通知範本，以及特許核准流程（Approval）相關型別。
 */

/** 通知記錄 */
export interface Notification {
  id: string;
  type: NotificationType;
  templateId?: string;
  recipientType: 'CUSTOMER' | 'EMPLOYEE';
  recipientId: string;
  recipientName: string;
  subject: string;
  content: string;
  status: NotificationStatus;
  taskId?: string;
  sentBy?: string;
  senderName?: string;
  senderRole?: string;
  sentAt?: string;
  /** 站內通知是否已讀（郵件通知記錄沒有此欄位） */
  isRead?: boolean;
  /** 已讀時間 */
  readAt?: string;
  createdAt: string;
}

/** 通知類型：排班提醒／客戶通知／員工派工通知／特許核准通知／核准結果通知 */
export type NotificationType =
  | 'SCHEDULE_REMINDER'
  | 'CUSTOMER_NOTIFY'
  | 'EMPLOYEE_DISPATCH'
  | 'CHANGE_APPROVAL'
  | 'APPROVAL_RESULT'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_CANCELED'
  | 'LICENSE_EXPIRY';
/** 通知狀態：已通知／未通知／已異動已通知／已異動未通知 */
export type NotificationStatus =
  'NOTIFIED' | 'NOT_NOTIFIED' | 'CHANGED_NOTIFIED' | 'CHANGED_NOT_NOTIFIED';

/** 通知範本 */
export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  subject: string;
  content: string;
  variables: string[];
  /** 每日合併信的分段：開頭／新增／修改／取消（每筆）／結尾 */
  header?: string;
  createdBlock?: string;
  updatedBlock?: string;
  canceledBlock?: string;
  /** 證照到期信：每位員工一行 */
  itemBlock?: string;
  footer?: string;
}

/** 特許核准申請單 */
export interface Approval {
  id: string;
  taskId: string;
  type: ApprovalType;
  status: ApprovalStatus;
  requestedBy: string;
  requestedByName: string;
  changeSummary?: string;
  diff?: {
    field: string;
    label: string;
    before?: string | number | null;
    after?: string | number | null;
  }[];
  overrideRemark?: string;
  violatedRules?: string[];
  /** 違規規則與中文說明（後端 task_alerts） */
  violations?: { ruleId: string; message: string }[];
  /** 申請對應的任務內容 */
  task?: import('./task').Task;
  approvers: ApprovalStep[];
  createdAt: string;
  updatedAt: string;
}

/** 特許核准類型：任務變更／警示特許 */
export type ApprovalType = 'TASK_CHANGE' | 'ALERT_OVERRIDE' | 'SCHEDULE_CHANGE' | 'SHIFT_CHANGE';
/** 特許核准狀態：待核准／已核准／已駁回／已撤回 */
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

/** 單一核准步驟（多層核准流程中的一關） */
export interface ApprovalStep {
  approverId: string;
  approverName: string;
  role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  comment?: string;
  decidedAt?: string;
}
