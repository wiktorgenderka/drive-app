'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from '@/components/ui/Toast';
import { ReactNode, useEffect } from 'react';
import { useThemeStore } from '@/stores/useThemeStore';
import ServiceWorkerRegistration from '@/components/pwa/ServiceWorkerRegistration';

function accentFg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.5 ? '#09090b' : '#ffffff';
}

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
    root.style.setProperty('--accent-fg', accentFg(accentColor));
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(accentColor.slice(i, i + 2), 16));
    root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.18)`);
  }, [mode, accentColor]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeWrapper>
        <ToastProvider>
          <ServiceWorkerRegistration />
          {children}
        </ToastProvider>
      </ThemeWrapper>
    </SessionProvider>
  );
}
