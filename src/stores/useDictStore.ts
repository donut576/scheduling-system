/**
 * 下拉選單字典資料 store
 *
 * 集中管理任務類型、班次、路線、證照、職位、群組等下拉選單選項資料。
 * 預設值取自 constants，未來可透過 loadDict 由後端 API 覆寫，
 * 並以 persist middleware 將部分資料快取於 localStorage。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SelectOption } from '@/types/common';
import {
  TASK_TYPE_OPTIONS,
  TASK_CONTENT_OPTIONS,
  SHIFT_OPTIONS,
  ROUTE_OPTIONS,
} from '@/constants/taskStatus';
import { LICENSE_TYPE_OPTIONS } from '@/constants/licenseTypes';
import { POSITION_OPTIONS } from '@/constants/positions';

interface DictState {
  /** 任務類型選項 */
  taskTypes: SelectOption[];
  /** 班次選項 */
  shifts: SelectOption[];
  /** 路線選項 */
  routes: SelectOption[];
  /** 任務內容選項 */
  contents: SelectOption[];
  /** 證照類型選項 */
  licenses: SelectOption[];
  /** 職位選項 */
  positions: SelectOption[];
  /** 群組選項 */
  groups: SelectOption[];
  /** 字典資料版本號，供未來快取失效判斷使用 */
  version: string;

  // Actions
  /** 從後端載入字典資料（目前尚未接上 API，先以本地常數為預設值） */
  loadDict: () => Promise<void>;
  /** 設定班次選項 */
  setShifts: (shifts: SelectOption[]) => void;
  /** 設定路線選項 */
  setRoutes: (routes: SelectOption[]) => void;
  /** 設定群組選項 */
  setGroups: (groups: SelectOption[]) => void;
}

/** 下拉選單字典資料 store（persist 至 localStorage） */
export const useDictStore = create<DictState>()(
  persist(
    (set) => ({
      taskTypes: TASK_TYPE_OPTIONS,
      shifts: SHIFT_OPTIONS,
      routes: ROUTE_OPTIONS,
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
