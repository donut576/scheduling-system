import type { PositionType } from '@/types/employee';
import type { SelectOption } from '@/types/common';

export const POSITION_MAP: Record<PositionType, string> = {
  STAFF: '一般員工',
  LEADER: '組長',
  DIRECTOR: '主任',
  MANAGER: '經理',
  ADMIN_STAFF: '行政',
};

export const POSITION_OPTIONS: SelectOption[] = Object.entries(POSITION_MAP).map(
  ([value, label]) => ({ label, value }),
);
