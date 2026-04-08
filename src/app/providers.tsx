'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from '@/components/ui/Toast';
import { ReactNode, useEffect } from 'react';
import { useThemeStore } from '@/stores/useThemeStore';

function ThemeWrapper({ children }: { children: ReactNode }) {
  const { mode, accentColor } = useThemeStore();

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.style.setProperty('--accent-color', accentColor);
  }, [mode, accentColor]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeWrapper>
        <ToastProvider>{children}</ToastProvider>
      </ThemeWrapper>
    </SessionProvider>
  );
}
