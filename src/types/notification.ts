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

export type NotificationType =
  | 'SCHEDULE_REMINDER'
  | 'CUSTOMER_NOTIFY'
  | 'EMPLOYEE_DISPATCH'
  | 'CHANGE_APPROVAL'
  | 'APPROVAL_RESULT';
export type NotificationStatus =
  'NOTIFIED' | 'NOT_NOTIFIED' | 'CHANGED_NOTIFIED' | 'CHANGED_NOT_NOTIFIED';

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  subject: string;
  content: string;
  variables: string[];
}

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

export type ApprovalType = 'SCHEDULE_CHANGE' | 'SHIFT_CHANGE' | 'ALERT_OVERRIDE';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export interface ApprovalStep {
  approverId: string;
  approverName: string;
  role: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  comment?: string;
  decidedAt?: string;
}
