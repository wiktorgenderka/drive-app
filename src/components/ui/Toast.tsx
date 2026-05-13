'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const typeConfig: Record<ToastType, { bar: string; icon: string; path: string }> = {
  success: {
    bar: 'bg-emerald-500',
    icon: 'text-emerald-400',
    path: 'M5 13l4 4L19 7',
  },
  error: {
    bar: 'bg-red-500',
    icon: 'text-red-400',
    path: 'M6 18L18 6M6 6l12 12',
  },
  warning: {
    bar: 'bg-amber-500',
    icon: 'text-amber-400',
    path: 'M12 9v2m0 4h.01M12 3l9.5 16.5H2.5L12 3z',
  },
  info: {
    bar: 'bg-accent',
    icon: 'text-accent',
    path: 'M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-24 right-4 z-[100] flex flex-col-reverse gap-2 max-w-xs sm:max-w-sm pointer-events-none">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const cfg = typeConfig[toast.type];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 60, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                className="pointer-events-auto overflow-hidden rounded-xl border border-card-border bg-card-bg shadow-xl"
              >
                {/* Colored top bar */}
                <div className={`h-0.5 w-full ${cfg.bar}`} />
                <div className="flex items-center gap-3 px-4 py-3">
                  <svg className={`h-4 w-4 shrink-0 ${cfg.icon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={cfg.path} />
                  </svg>
                  <p className="flex-1 text-sm text-foreground">{toast.message}</p>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="shrink-0 text-muted transition hover:text-foreground"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
