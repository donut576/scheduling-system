import type { TaskStatus } from '@/types/task';
import type { SelectOption } from '@/types/common';

export const TASK_STATUS_MAP: Record<TaskStatus, { label: string; color: string }> = {
  UNSCHEDULED: { label: '未排班', color: '#909399' },
  SCHEDULED: { label: '已排班', color: '#52C41A' },
  MODIFIED: { label: '更改', color: '#FAAD14' },
  CONFIRMED: { label: '已確認', color: '#1B5E9C' },
  PENDING_APPROVAL: { label: '待核准', color: '#FAAD14' },
  CANCELLED: { label: '已取消', color: '#909399' },
};

export const TASK_TYPE_OPTIONS: SelectOption[] = [
  { label: '合約', value: 'CONTRACT' },
  { label: '單次', value: 'ONETIME' },
  { label: 'ESR', value: 'ESR' },
];

export const TASK_CONTENT_OPTIONS: SelectOption[] = [
  { label: 'P', value: 'P' },
  { label: 'R', value: 'R' },
  { label: 'S', value: 'S' },
  { label: '白蟻', value: 'TERMITE' },
  { label: '火蟻', value: 'FIRE_ANT' },
  { label: '臭蟲', value: 'BED_BUG' },
  { label: '車輛保養', value: 'VEHICLE_MAINTENANCE' },
  { label: '培訓及會議', value: 'TRAINING' },
  { label: '其他', value: 'OTHER' },
];
