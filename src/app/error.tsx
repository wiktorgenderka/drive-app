'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="flex flex-col items-center gap-6"
      >
        {/* Icon */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-red-500/10" />
          <div className="absolute inset-2 rounded-full bg-red-500/10 animate-pulse" />
          <span className="relative text-5xl">⚠️</span>
        </div>

        {/* Text */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coś poszło nie tak</h1>
          <p className="mt-2 text-sm text-muted max-w-xs">
            Silnik driveApp napotkał błąd. Możesz spróbować ponownie lub wrócić na stronę główną.
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-[11px] text-muted/60">#{error.digest}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={reset}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg shadow-lg transition hover:opacity-90"
          >
            Spróbuj ponownie
          </motion.button>
          <motion.a
            whileTap={{ scale: 0.96 }}
            href="/dashboard"
            className="rounded-xl border border-card-border bg-card-bg px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-input-bg"
          >
            Wróć do aplikacji
          </motion.a>
        </div>
      </motion.div>
    </div>
  );
}
