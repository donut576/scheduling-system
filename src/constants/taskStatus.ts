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
  SCHEDULED: { label: '已排班', color: '#52C41A' },
  UNSCHEDULED: { label: '未排班', color: '#8c8c8c' },
  MODIFIED: { label: '更改', color: '#F5222D' },
  CANCELLED: { label: '已取消', color: '#909399' },
  CONFIRMED: { label: '已確認', color: '#1677FF' },
  PENDING_APPROVAL: { label: '待核准', color: '#FAAD14' },
};

/** 任務狀態下拉選單選項（四種主要狀態：已排班、未排班、更改、已取消） */
export const TASK_STATUS_OPTIONS: SelectOption[] = [
  { label: '已排班', value: 'SCHEDULED' },
  { label: '未排班', value: 'UNSCHEDULED' },
  { label: '更改', value: 'MODIFIED' },
  { label: '已取消', value: 'CANCELLED' },
];

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
  { label: '培訓', value: 'TRAINING' },
  { label: '其他', value: 'OTHER' },
];

/** 任務內容中英文標籤對照表 */
export const TASK_CONTENT_LABEL_MAP: Record<string, string> = {
  P: 'P',
  R: 'R',
  S: 'S',
  TERMITE: '白蟻',
  FIRE_ANT: '火蟻',
  BED_BUG: '臭蟲',
  VEHICLE_MAINTENANCE: '車輛保養',
  TRAINING: '培訓',
  TRAINING_MEETING: '培訓',
  OTHER: '其他',
};

/** 格式化任務內容陣列為中文顯示字串 */
export const formatTaskContents = (
  contents?: string[] | null,
  separator: string = '、',
): string => {
  if (!Array.isArray(contents) || contents.length === 0) return '-';
  return contents.map((c) => TASK_CONTENT_LABEL_MAP[c] || c).join(separator);
};

// 班次下拉選單假資料（demo 用途，供 useDictStore 預設值使用）
export const SHIFT_OPTIONS: SelectOption[] = [
  { label: '早班', value: '早班' },
  { label: '午班', value: '午班' },
  { label: '晚班', value: '晚班' },
  { label: '大夜班', value: '大夜班' },
];

/** 路線/路次下拉選單選項（第一路、第二路...） */
export const ROUTE_OPTIONS: SelectOption[] = [
  { label: '第一路', value: '第一路' },
  { label: '第二路', value: '第二路' },
  { label: '第三路', value: '第三路' },
  { label: '第四路', value: '第四路' },
  { label: '第五路', value: '第五路' },
  { label: '第六路', value: '第六路' },
  { label: '第七路', value: '第七路' },
  { label: '第八路', value: '第八路' },
];
