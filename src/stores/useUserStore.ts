/**
 * 使用者登入狀態 store
 *
 * 管理登入 token、使用者個人資料與登入失敗次數，並提供 login/logout 等操作。
 * 以 persist middleware 將 token/user 存於 sessionStorage，並在還原（hydration）
 * 完成後同步重建權限狀態（見檔案底部 syncPermissionsFromUser）。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LoginRequest, UserProfile } from '@/types/auth';
import { authApi } from '@/api/auth';
import { setTokenGetter, setUnauthorizedHandler } from '@/api/instance';
import { usePermissionStore } from '@/stores/usePermissionStore';

interface UserState {
  /** 登入後取得之存取權杖 */
  token: string | null;
  /** 目前登入使用者之個人資料 */
  user: UserProfile | null;
  /** 連續登入失敗次數 */
  loginFailCount: number;

  // Actions
  /** 以帳號密碼登入，成功後儲存 token 與使用者資料 */
  login: (credentials: LoginRequest) => Promise<void>;
  /** 登出並清除狀態，導向登入頁 */
  logout: () => void;
  /** 直接設定登入權杖 */
  setToken: (token: string) => void;
  /** 直接設定使用者個人資料 */
  setUser: (user: UserProfile) => void;
  /** 登入失敗次數加一 */
  incrementLoginFail: () => void;
  /** 重置登入失敗次數 */
  resetLoginFail: () => void;
}

/** 使用者登入狀態 store（persist 至 sessionStorage） */
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
          // 登入失敗時累計失敗次數，並向外拋出統一錯誤訊息
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

// 初始化 API 攔截器所需之 token 取得函式與未授權（401）處理函式
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
