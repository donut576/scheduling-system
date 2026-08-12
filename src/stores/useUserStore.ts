import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LoginRequest, UserProfile } from '@/types/auth';
import { authApi } from '@/api/auth';
import { setTokenGetter, setUnauthorizedHandler } from '@/api/instance';
import { usePermissionStore } from '@/stores/usePermissionStore';

interface UserState {
  token: string | null;
  user: UserProfile | null;
  loginFailCount: number;

  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  setToken: (token: string) => void;
  setUser: (user: UserProfile) => void;
  incrementLoginFail: () => void;
  resetLoginFail: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loginFailCount: 0,

      login: async (credentials: LoginRequest) => {
        try {
          const response = await authApi.login(credentials);
          const { accessToken, user } = response.data.data;
          set({ token: accessToken, user, loginFailCount: 0 });
        } catch {
          set({ loginFailCount: get().loginFailCount + 1 });
          throw new Error('登入失敗');
        }
      },

      logout: () => {
        set({ token: null, user: null, loginFailCount: 0 });
        window.location.href = '/login';
      },

      setToken: (token: string) => set({ token }),
      setUser: (user: UserProfile) => set({ user }),
      incrementLoginFail: () => set({ loginFailCount: get().loginFailCount + 1 }),
      resetLoginFail: () => set({ loginFailCount: 0 }),
    }),
    {
      name: 'ecolab-user-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    },
  ),
);

// Initialize API interceptor token getter
setTokenGetter(() => useUserStore.getState().token);
setUnauthorizedHandler(() => useUserStore.getState().logout());

/**
 * usePermissionStore（accessibleRoutes/menuTree/permissionCodes）並未持久化，僅 token/user
 * 透過 persist 存於 sessionStorage。因此重新整理頁面後，雖然登入狀態（token/user）仍在，
 * 權限狀態卻是空的，導致所有受權限保護的路由皆被 RouteGuard 導向 /403。
 *
 * 此處於 useUserStore 完成 rehydration（從 sessionStorage 還原狀態）後，若還原出已登入的
 * 使用者，立即以該使用者的 role/permissions 重建權限狀態，行為等同登入當下呼叫
 * buildPermissions。使用 onFinishHydration 而非假設同步還原完成，以涵蓋還原時機的不確定性。
 */
function syncPermissionsFromUser(user: UserProfile | null) {
  if (user) {
    usePermissionStore.getState().buildPermissions(user.permissions, user.role);
  }
}

useUserStore.persist.onFinishHydration((state) => syncPermissionsFromUser(state.user));
if (useUserStore.persist.hasHydrated()) {
  syncPermissionsFromUser(useUserStore.getState().user);
}
