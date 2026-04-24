'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Wystąpił błąd. Spróbuj ponownie.');
        return;
      }

      setSent(true);
    } catch {
      setError('Wystąpił błąd. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-card-border bg-card-bg p-8 shadow-xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-600/15 text-green-500">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14h-.08z" />
          </svg>
        </div>
        <h2 className="mb-2 text-lg font-semibold text-foreground">Sprawdź skrzynkę</h2>
        <p className="text-sm text-muted">
          Jeśli konto z adresem <span className="font-medium text-foreground">{email}</span> istnieje,
          wysłaliśmy link do resetowania hasła. Link wygaśnie po 1 godzinie.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-blue-500 hover:text-blue-400"
        >
          ← Wróć do logowania
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-card-border bg-card-bg p-8 shadow-xl">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-semibold text-foreground">Nie pamiętasz hasła?</h2>
        <p className="mt-1 text-sm text-muted">
          Podaj swój email, a wyślemy link do resetowania hasła.
        </p>
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
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
            Adres email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="twoj@email.com"
            className="w-full rounded-lg border border-input-border bg-input-bg px-4 py-2.5 text-sm text-foreground placeholder-muted-light outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-11 items-center justify-center rounded-lg bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            'Wyślij link resetu'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-blue-500 hover:text-blue-400">
          ← Wróć do logowania
        </Link>
      </p>
    </div>
  );
}
