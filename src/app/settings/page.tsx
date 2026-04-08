'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import SettingsPanel from '@/components/settings/SettingsPanel';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-card-border bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="rounded-lg p-1.5 text-muted transition hover:bg-input-bg hover:text-foreground"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-lg font-semibold text-foreground">Settings</h1>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="mx-auto max-w-2xl px-4 py-6">
          <SettingsPanel />
        </main>
      </div>
    </AuthGuard>
  );
}
