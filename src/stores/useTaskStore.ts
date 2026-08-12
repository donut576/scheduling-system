/**
 * 任務列表與表單狀態 store
 *
 * 管理任務列表查詢篩選條件、任務表單暫存草稿（跨頁面/彈窗切換時保留輸入），
 * 以及最近一次警示規則驗證結果。
 */
import { create } from 'zustand';
import type { TaskListParams } from '@/types/task';
import type { TaskFormData } from '@/types/task';
import type { AlertValidationResult } from '@/types/alert';

interface TaskState {
  /** 任務列表查詢篩選條件 */
  filters: TaskListParams;
  /** 任務表單暫存草稿資料 */
  formDraft: Partial<TaskFormData> | null;
  /** 最近一次警示規則驗證結果 */
  alertResults: AlertValidationResult | null;

  // Actions
  /** 部分更新查詢篩選條件 */
  setFilters: (filters: Partial<TaskListParams>) => void;
  /** 重置查詢篩選條件為預設值 */
  resetFilters: () => void;
  /** 設定表單草稿資料 */
  setFormDraft: (draft: Partial<TaskFormData> | null) => void;
  /** 設定警示規則驗證結果 */
  setAlertResults: (results: AlertValidationResult | null) => void;
}

/** 查詢篩選條件預設值：第 1 頁，每頁 20 筆 */
const DEFAULT_FILTERS: TaskListParams = {
  page: 1,
  pageSize: 20,
};

/** 任務列表與表單狀態 store */
export const useTaskStore = create<TaskState>((set, get) => ({
  filters: { ...DEFAULT_FILTERS },
  formDraft: null,
  alertResults: null,

  setFilters: (filters: Partial<TaskListParams>) =>
    set({ filters: { ...get().filters, ...filters } }),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  setFormDraft: (draft: Partial<TaskFormData> | null) => set({ formDraft: draft }),

  setAlertResults: (results: AlertValidationResult | null) => set({ alertResults: results }),
}));
