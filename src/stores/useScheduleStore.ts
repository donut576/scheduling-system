/**
 * 排班檢視狀態 store
 *
 * 管理班表檢視模式（日/週/月）、檢視維度（依客戶/依員工）、日期範圍，
 * 以及尚未送出的變更緩衝區（changeBuffer）、復原堆疊（undoStack）與衝突警示清單。
 */
import { create } from 'zustand';
import type { ScheduleChange, ScheduleViewMode, ScheduleDimension } from '@/types/schedule';
import type { AlertViolation } from '@/types/alert';
import dayjs from 'dayjs';

interface ScheduleState {
  /** 目前班表檢視模式（日/週/月） */
  currentView: ScheduleViewMode;
  /** 目前檢視維度（依客戶或依員工） */
  dimension: ScheduleDimension;
  /** 目前檢視之日期範圍 */
  dateRange: { start: string; end: string };
  /** 尚未送出之排班變更緩衝區（用於批次提交或復原） */
  changeBuffer: ScheduleChange[];
  /** 目前偵測到的排班衝突/警示清單 */
  conflictList: AlertViolation[];
  /** 已復原之變更堆疊 */
  undoStack: ScheduleChange[];

  // Actions
  /** 設定班表檢視模式 */
  setView: (view: ScheduleViewMode) => void;
  /** 設定檢視維度 */
  setDimension: (dim: ScheduleDimension) => void;
  /** 設定日期範圍 */
  setDateRange: (range: { start: string; end: string }) => void;
  /** 將一筆變更加入緩衝區 */
  pushChange: (change: ScheduleChange) => void;
  /** 復原最後一筆變更（移至 undoStack） */
  undo: () => void;
  /** 清空變更緩衝區與復原堆疊 */
  clearChanges: () => void;
  /** 設定衝突警示清單 */
  setConflictList: (conflicts: AlertViolation[]) => void;
}

/** 排班檢視狀態 store */
export const useScheduleStore = create<ScheduleState>((set, get) => ({
  currentView: 'day',
  dimension: 'customer',
  dateRange: {
    start: dayjs().format('YYYY-MM-DD'),
    end: dayjs().format('YYYY-MM-DD'),
  },
  changeBuffer: [],
  conflictList: [],
  undoStack: [],

  setView: (view: ScheduleViewMode) => set({ currentView: view }),

  setDimension: (dim: ScheduleDimension) => set({ dimension: dim }),

  setDateRange: (range: { start: string; end: string }) => set({ dateRange: range }),

  pushChange: (change: ScheduleChange) => {
    const { changeBuffer } = get();
    set({ changeBuffer: [...changeBuffer, change] });
  },

  undo: () => {
    const { changeBuffer, undoStack } = get();
    if (changeBuffer.length === 0) return;
    // 取出緩衝區最後一筆變更，將其移出 changeBuffer 並推入 undoStack
    const lastChange = changeBuffer[changeBuffer.length - 1];
    if (lastChange) {
      set({
        changeBuffer: changeBuffer.slice(0, -1),
        undoStack: [...undoStack, lastChange],
      });
    }
  },

  clearChanges: () => set({ changeBuffer: [], undoStack: [] }),

  setConflictList: (conflicts: AlertViolation[]) => set({ conflictList: conflicts }),
}));
