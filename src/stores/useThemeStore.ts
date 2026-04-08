import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';
export type MapTheme = 'auto' | 'dark' | 'light' | 'satellite' | 'navigation' | 'outdoors';

interface ThemeState {
  mode: ThemeMode;
  accentColor: string;
  mapTheme: MapTheme;
}

interface ThemeActions {
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setAccentColor: (color: string) => void;
  setMapTheme: (theme: MapTheme) => void;
}

type ThemeStore = ThemeState & ThemeActions;

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'dark',
      accentColor: '#3b82f6',
      mapTheme: 'auto',

      setMode: (mode) => set({ mode }),

      toggleMode: () =>
        set((state) => ({
          mode: state.mode === 'dark' ? 'light' : 'dark',
        })),

      setAccentColor: (accentColor) => set({ accentColor }),

      setMapTheme: (mapTheme) => set({ mapTheme }),
    }),
    {
      name: 'drive-app-theme',
    }
  )
);
