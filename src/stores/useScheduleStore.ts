import { create } from 'zustand';
import type { ScheduleChange, ScheduleViewMode, ScheduleDimension } from '@/types/schedule';
import type { AlertViolation } from '@/types/alert';
import dayjs from 'dayjs';

interface ScheduleState {
  currentView: ScheduleViewMode;
  dimension: ScheduleDimension;
  dateRange: { start: string; end: string };
  changeBuffer: ScheduleChange[];
  conflictList: AlertViolation[];
  undoStack: ScheduleChange[];

  // Actions
  setView: (view: ScheduleViewMode) => void;
  setDimension: (dim: ScheduleDimension) => void;
  setDateRange: (range: { start: string; end: string }) => void;
  pushChange: (change: ScheduleChange) => void;
  undo: () => void;
  clearChanges: () => void;
  setConflictList: (conflicts: AlertViolation[]) => void;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  currentView: 'week',
  dimension: 'customer',
  dateRange: {
    start: dayjs().startOf('week').format('YYYY-MM-DD'),
    end: dayjs().endOf('week').format('YYYY-MM-DD'),
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
