/**
 * 通知與異動核准相關型別定義
 *
 * 定義通知（Notification）、通知範本，以及異動核准流程（Approval）相關型別。
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
  sentAt?: string;
  createdAt: string;
}

/** 通知類型：排班提醒／客戶通知／員工派工通知／異動核准通知／核准結果通知 */
export type NotificationType =
  | 'SCHEDULE_REMINDER'
  | 'CUSTOMER_NOTIFY'
  | 'EMPLOYEE_DISPATCH'
  | 'CHANGE_APPROVAL'
  | 'APPROVAL_RESULT';
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
}

/** 異動核准申請單 */
export interface Approval {
  id: string;
  taskId: string;
  type: ApprovalType;
  status: ApprovalStatus;
  requestedBy: string;
  requestedByName: string;
  approvers: ApprovalStep[];
  createdAt: string;
  updatedAt: string;
}

/** 異動核准類型：排班變更／班別變更／警示覆蓋 */
export type ApprovalType = 'SCHEDULE_CHANGE' | 'SHIFT_CHANGE' | 'ALERT_OVERRIDE';
/** 異動核准狀態：待審批／已核准／已駁回／已撤回 */
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

/** 單一核准步驟（多層核准流程中的一關） */
export interface ApprovalStep {
  approverId: string;
  approverName: string;
  role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comment?: string;
  decidedAt?: string;
}
