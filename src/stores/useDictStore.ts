import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SelectOption } from '@/types/common';
import { TASK_TYPE_OPTIONS, TASK_CONTENT_OPTIONS } from '@/constants/taskStatus';
import { LICENSE_TYPE_OPTIONS } from '@/constants/licenseTypes';
import { POSITION_OPTIONS } from '@/constants/positions';

interface DictState {
  taskTypes: SelectOption[];
  shifts: SelectOption[];
  routes: SelectOption[];
  contents: SelectOption[];
  licenses: SelectOption[];
  positions: SelectOption[];
  groups: SelectOption[];
  version: string;

  // Actions
  loadDict: () => Promise<void>;
  setShifts: (shifts: SelectOption[]) => void;
  setRoutes: (routes: SelectOption[]) => void;
  setGroups: (groups: SelectOption[]) => void;
}

export const useDictStore = create<DictState>()(
  persist(
    (set) => ({
      taskTypes: TASK_TYPE_OPTIONS,
      shifts: [],
      routes: [],
      contents: TASK_CONTENT_OPTIONS,
      licenses: LICENSE_TYPE_OPTIONS,
      positions: POSITION_OPTIONS,
      groups: [],
      version: '1.0.0',

      loadDict: async () => {
        // In production, fetch from API: GET /api/v1/dict
        // For now, use local constants as defaults
        // const response = await apiInstance.get('/dict');
        // set({ shifts: response.data.data.shifts, ... });
      },

      setShifts: (shifts: SelectOption[]) => set({ shifts }),
      setRoutes: (routes: SelectOption[]) => set({ routes }),
      setGroups: (groups: SelectOption[]) => set({ groups }),
    }),
    {
      name: 'ecolab-dict-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        shifts: state.shifts,
        routes: state.routes,
        groups: state.groups,
        version: state.version,
      }),
    },
  ),
);
