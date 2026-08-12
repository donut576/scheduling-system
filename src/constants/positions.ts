/**
 * 員工職位相關常數
 *
 * 提供職位代碼對應顯示文字之對照表，以及供下拉選單使用之選項清單。
 */
import type { PositionType } from '@/types/employee';
import type { SelectOption } from '@/types/common';

/** 職位代碼對應顯示文字 */
export const POSITION_MAP: Record<PositionType, string> = {
  STAFF: '一般員工',
  LEADER: '組長',
  MANAGER: '經理',
  ADMIN_STAFF: '行政',
};

/** 職位下拉選單選項（由 POSITION_MAP 轉換而來） */
export const POSITION_OPTIONS: SelectOption[] = Object.entries(POSITION_MAP).map(
  ([value, label]) => ({ label, value }),
);
