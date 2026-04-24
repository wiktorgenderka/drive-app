import { create } from 'zustand';
import type { User } from '@/types';

export type { User };

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthActions {
  login: (user: User) => void;
  logout: () => void;
  updateLocation: (latitude: number, longitude: number) => void;
  setLoading: (isLoading: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: (user) =>
    set({
      user,
      isAuthenticated: true,
      isLoading: false,
    }),

  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    }),

  updateLocation: (latitude, longitude) =>
    set((state) => {
      if (!state.user) return state;
      return { user: { ...state.user, latitude, longitude } };
    }),

  setLoading: (isLoading) => set({ isLoading }),
}));
