/** 儀表板共用的純函式與常數（不放元件，避免 react-refresh 警告） */
import React from 'react';
import { EditOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import { hexToRgb } from '@/utils/colorContrast';
import { TASK_CONTENT_LABEL_MAP } from '@/constants/taskStatus';
import { designTokens } from '@/styles/tokens';

export const hasValue = (v: React.ReactNode): boolean =>
  !(v === undefined || v === null || v === '' || v === false);

/** 色碼 → 半透明底色；非 hex 時退回中性灰 */
export const hexToTint = (hex: string, alpha: number): string => {
  try {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return 'rgba(140, 140, 140, 0.12)';
  }
};

export const TASK_TYPE_LABEL: Record<string, string> = {
  CONTRACT: '合約',
  ONETIME: '單次',
  ESR: 'ESR',
};

/** YYYY-MM-DD → M/D */
export const formatMD = (dateStr: string): string =>
  `${Number(dateStr.slice(5, 7))}/${Number(dateStr.slice(8, 10))}`;

/** 任務內容代碼 → 顯示文字（P／R／S 維持原樣，TERMITE → 白蟻…） */
export const contentLabel = (c: string): string => TASK_CONTENT_LABEL_MAP[c] ?? c;

/** 列表第二行用的時間文字：彈性＝「彈性」，固定＝HHmm */
export const timeText = (time?: string | null, flexible?: boolean): string =>
  flexible ? '彈性' : (time ?? '');

/** 任務異動類型配色：新增／修改＝主題藍，取消＝沉穩紅（不加刪除線） */
export type TaskAction = 'CREATED' | 'UPDATED' | 'CANCELED';
export const CANCEL_COLOR = '#B4483F';
export const ACTION_META: Record<
  TaskAction,
  { label: string; color: string; icon: React.ReactNode }
> = {
  CREATED: { label: '新增', color: designTokens.colors.primary, icon: <PlusOutlined /> },
  UPDATED: { label: '修改', color: designTokens.colors.primary, icon: <EditOutlined /> },
  CANCELED: { label: '取消', color: CANCEL_COLOR, icon: <StopOutlined /> },
};
