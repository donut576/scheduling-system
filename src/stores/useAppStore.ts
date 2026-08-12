import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TabItem } from '@/types/common';

interface AppState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  locale: 'zh-TW' | 'en-US';
  tabs: TabItem[];

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLocale: (locale: 'zh-TW' | 'en-US') => void;
  addTab: (tab: TabItem) => void;
  removeTab: (key: string) => void;
  setActiveTab: (key: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      theme: 'light',
      locale: 'zh-TW',
      tabs: [{ key: '/dashboard', label: '儀表板', closable: false }],

      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
      setTheme: (theme: 'light' | 'dark') => set({ theme }),
      setLocale: (locale: 'zh-TW' | 'en-US') => set({ locale }),

      addTab: (tab: TabItem) => {
        const { tabs } = get();
        if (!tabs.find((t) => t.key === tab.key)) {
          set({ tabs: [...tabs, tab] });
        }
      },

      removeTab: (key: string) => {
        const { tabs } = get();
        set({ tabs: tabs.filter((t) => t.key !== key || !t.closable) });
      },

      setActiveTab: (_key: string) => {
        // Navigation handled by React Router, this is for UI state tracking
      },
    }),
    {
      name: 'ecolab-app-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        locale: state.locale,
        tabs: state.tabs,
      }),
    },
  ),
);
