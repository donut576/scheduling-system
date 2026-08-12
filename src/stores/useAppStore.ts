import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AppState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark';
  locale: 'zh-TW' | 'en-US';

  // Actions
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLocale: (locale: 'zh-TW' | 'en-US') => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      theme: 'light',
      locale: 'zh-TW',

      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setSidebarCollapsed: (collapsed: boolean) => set({ sidebarCollapsed: collapsed }),
      setTheme: (theme: 'light' | 'dark') => set({ theme }),
      setLocale: (locale: 'zh-TW' | 'en-US') => set({ locale }),
    }),
    {
      name: 'ecolab-app-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        locale: state.locale,
      }),
    },
  ),
);
