/**
 * 異動核准類型與狀態相關常數
 *
 * 提供異動核准類型/狀態對應之顯示文字（與狀態對應顏色），供核准列表與詳情頁使用。
 */
import type { ApprovalType, ApprovalStatus } from '@/types/notification';

/** 異動核准類型對應顯示文字 */
export const APPROVAL_TYPE_MAP: Record<ApprovalType, string> = {
  TASK_CHANGE: '任務變更',
  ALERT_OVERRIDE: '警示覆蓋',
  SCHEDULE_CHANGE: '任務變更',
  SHIFT_CHANGE: '任務變更',
};

/** 異動核准狀態對應顯示文字與顏色 */
export const APPROVAL_STATUS_MAP: Record<ApprovalStatus, { label: string; color: string }> = {
  PENDING: { label: '待核准', color: '#FAAD14' },
  APPROVED: { label: '已核准', color: '#52C41A' },
  REJECTED: { label: '已駁回', color: '#F5222D' },
  WITHDRAWN: { label: '已撤回', color: '#909399' },
};
