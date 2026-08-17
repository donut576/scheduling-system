/**
 * 應用程式全域設定 store
 *
 * 管理側邊欄收合狀態、主題（light/dark）與語系（zh-TW/en-US）等 UI 層級設定，
 * 並透過 zustand persist middleware 將設定寫入 localStorage，重新整理頁面後仍可保留。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AppState {
  /** 側邊欄是否為收合狀態 */
  sidebarCollapsed: boolean;
  /** 目前主題模式 */
  theme: 'light' | 'dark';
  /** 目前語系 */
  locale: 'zh-TW' | 'en-US';

  // Actions
  /** 切換側邊欄收合／展開狀態 */
  toggleSidebar: () => void;
  /** 直接設定側邊欄收合狀態 */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** 設定主題模式 */
  setTheme: (theme: 'light' | 'dark') => void;
  /** 設定語系 */
  setLocale: (locale: 'zh-TW' | 'en-US') => void;
}

/** 應用程式全域設定 store（persist 至 localStorage） */
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: true,
      theme: 'light',
      locale: 'zh-TW',

      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
      setTheme: (theme: 'light' | 'dark') => set({ theme }),
      setLocale: (_locale: 'zh-TW' | 'en-US') => set({ locale: 'zh-TW' }),
    }),
    {
      name: 'ecolab-app-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    },
  ),
);
