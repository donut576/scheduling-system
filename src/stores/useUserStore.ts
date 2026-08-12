import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LoginRequest, UserProfile } from '@/types/auth';
import { authApi } from '@/api/auth';
import { setTokenGetter, setUnauthorizedHandler } from '@/api/instance';

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
