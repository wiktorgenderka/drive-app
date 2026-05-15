'use client';

import { useState, type FormEvent } from 'react';

interface CreateConvoyModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function CreateConvoyModal({
  open,
  onClose,
  onCreated,
}: CreateConvoyModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/convoy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Nie udało się utworzyć konwoju.');
        return;
      }

      setName('');
      onCreated?.();
    } catch {
      setError('Wystąpił nieoczekiwany błąd.');
    } finally {
      setLoading(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card-bg p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Nowy konwój</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-input-bg hover:text-foreground"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="convoy-name"
              className="mb-1.5 block text-sm font-medium text-muted"
            >
              Nazwa konwoju
            </label>
            <input
              id="convoy-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Weekendowa wyprawa"
              className="w-full rounded-xl border border-card-border bg-input-bg px-4 py-2.5 text-sm text-foreground placeholder-muted outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-card-border bg-card-bg py-2.5 text-sm font-medium text-muted transition hover:bg-input-bg hover:text-foreground"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                'Utwórz konwój'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
