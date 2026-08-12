import { create } from 'zustand';
import type { TaskListParams } from '@/types/task';
import type { TaskFormData } from '@/types/task';
import type { AlertValidationResult } from '@/types/alert';

interface TaskState {
  filters: TaskListParams;
  formDraft: Partial<TaskFormData> | null;
  alertResults: AlertValidationResult | null;

  // Actions
  setFilters: (filters: Partial<TaskListParams>) => void;
  resetFilters: () => void;
  setFormDraft: (draft: Partial<TaskFormData> | null) => void;
  setAlertResults: (results: AlertValidationResult | null) => void;
}

const DEFAULT_FILTERS: TaskListParams = {
  page: 1,
  pageSize: 20,
};

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
