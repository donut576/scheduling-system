import type { ApprovalType, ApprovalStatus } from '@/types/notification';

export const APPROVAL_TYPE_MAP: Record<ApprovalType, string> = {
  SCHEDULE_CHANGE: '排班變更',
  SHIFT_CHANGE: '班別變更',
  ALERT_OVERRIDE: '警示覆蓋',
};

export const APPROVAL_STATUS_MAP: Record<ApprovalStatus, { label: string; color: string }> = {
  PENDING: { label: '待審批', color: '#FAAD14' },
  APPROVED: { label: '已核准', color: '#52C41A' },
  REJECTED: { label: '已駁回', color: '#F5222D' },
  WITHDRAWN: { label: '已撤回', color: '#909399' },
};
