/**
 * 任務狀態、類型與下拉選單常數
 *
 * 提供任務狀態對應顯示文字/顏色，以及任務類型、任務內容、班次、路線之
 * 下拉選單選項（班次、路線為 demo 假資料，供 useDictStore 預設值使用）。
 */
import type { TaskStatus } from '@/types/task';
import type { SelectOption } from '@/types/common';

/** 任務狀態對應顯示文字與顏色 */
export const TASK_STATUS_MAP: Record<TaskStatus, { label: string; color: string }> = {
  UNSCHEDULED: { label: '未排班', color: '#909399' },
  SCHEDULED: { label: '已排班', color: '#52C41A' },
  MODIFIED: { label: '更改', color: '#FAAD14' },
  CONFIRMED: { label: '已確認', color: '#1B5E9C' },
  PENDING_APPROVAL: { label: '待核准', color: '#FAAD14' },
  CANCELLED: { label: '已取消', color: '#909399' },
};

/** 任務類型下拉選單選項 */
export const TASK_TYPE_OPTIONS: SelectOption[] = [
  { label: '合約', value: 'CONTRACT' },
  { label: '單次', value: 'ONETIME' },
  { label: 'ESR', value: 'ESR' },
];

/** 任務內容（服務項目）下拉選單選項 */
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

// 班次下拉選單假資料（demo 用途，供 useDictStore 預設值使用）
export const SHIFT_OPTIONS: SelectOption[] = [
  { label: '早班', value: '早班' },
  { label: '午班', value: '午班' },
  { label: '晚班', value: '晚班' },
  { label: '大夜班', value: '大夜班' },
];

/** 路線下拉選單假資料（demo 用途，供 useDictStore 預設值使用） */
export const ROUTE_OPTIONS: SelectOption[] = [
  { label: '路線A', value: '路線A' },
  { label: '路線B', value: '路線B' },
  { label: '路線C', value: '路線C' },
  { label: '路線D', value: '路線D' },
];
