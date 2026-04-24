'use client';

import { Suspense, useState, type FormEvent, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!token) setError('Brak tokenu resetu. Sprawdź link w emailu.');
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Hasła nie są identyczne.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Wystąpił błąd. Spróbuj ponownie.');
        return;
      }

      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch {
      setError('Wystąpił błąd. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-card-border bg-card-bg p-8 shadow-xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-600/15 text-green-500">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-semibold text-foreground">Hasło zmienione!</h2>
        <p className="text-sm text-muted">Zostaniesz przekierowany do logowania za chwilę...</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-blue-500 hover:text-blue-400">
          Zaloguj się teraz
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-8 shadow-xl">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-foreground">Ustaw nowe hasło</h2>
        <p className="mt-1 text-sm text-muted">Hasło musi mieć min 8 znaków, wielką literę i cyfrę.</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
            Nowe hasło
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 znaków, wielka litera, cyfra"
              className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 pr-10 text-sm text-foreground placeholder-muted-light outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-foreground">
            Powtórz hasło
          </label>
          <div className="relative">
            <input
              id="confirm"
              type={showConfirm ? 'text' : 'password'}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Powtórz nowe hasło"
              className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 pr-10 text-sm text-foreground placeholder-muted-light outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-foreground"
              tabIndex={-1}
            >
              {showConfirm ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !token}
          className="mt-2 flex h-11 items-center justify-center rounded-lg bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            'Zmień hasło'
          )}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-card-border bg-card-bg p-8 shadow-xl text-center text-muted">Ładowanie...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
