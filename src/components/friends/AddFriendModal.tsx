'use client';

import { useState, useRef, useCallback, type FormEvent } from 'react';

interface SearchUser {
  id: string;
  name: string;
  image: string | null;
  carDisplay: string | null;
}

interface AddFriendModalProps {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

export default function AddFriendModal({ open, onClose, onAdded }: AddFriendModalProps) {
  const [tab, setTab] = useState<'search' | 'email'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.data ?? []);
      }
    } catch { /* silent */ } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => searchUsers(value), 280);
  }

  async function sendRequest(payload: { email?: string; userId?: string }) {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Nie udaĹ‚o siÄ™ wysĹ‚aÄ‡ zaproszenia.'); return; }
      setSuccess('Zaproszenie wysĹ‚ane!');
      setQuery('');
      setResults([]);
      setEmail('');
      onAdded?.();
    } catch {
      setError('Nieoczekiwany bĹ‚Ä…d.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    sendRequest({ email });
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-card-border bg-card-bg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-base font-semibold text-foreground">Dodaj znajomego</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition hover:bg-input-bg hover:text-foreground">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="mx-5 mb-3 flex gap-1 rounded-xl bg-input-bg p-1">
          <button onClick={() => setTab('search')} className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${tab === 'search' ? 'bg-card-bg text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}>
            Szukaj po nazwie
          </button>
          <button onClick={() => setTab('email')} className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${tab === 'email' ? 'bg-card-bg text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}>
            WyĹ›lij na e-mail
          </button>
        </div>

        <div className="px-5 pb-5">
          {/* Feedback */}
          {error && <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
          {success && <p className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">{success}</p>}

          {tab === 'search' ? (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Szukaj kierowcĂłw..."
                  className="w-full rounded-xl border border-card-border bg-input-bg py-2.5 pl-10 pr-10 text-sm text-foreground placeholder-muted outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
                {searching && (
                  <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
              </div>

              {results.length > 0 ? (
                <div className="flex flex-col gap-1 overflow-hidden rounded-xl border border-card-border">
                  {results.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-input-bg transition">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-input-bg">
                        {user.image
                          ? <img src={user.image} alt={user.name} className="h-full w-full object-cover" loading="lazy" />
                          : <span className="text-sm font-bold text-muted">{user.name[0]?.toUpperCase()}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                        {user.carDisplay && <p className="text-xs text-muted truncate">{user.carDisplay}</p>}
                      </div>
                      <button
                        onClick={() => sendRequest({ userId: user.id })}
                        disabled={loading}
                        className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
                      >
                        ZaproĹ›
                      </button>
                    </div>
                  ))}
                </div>
              ) : query.length >= 2 && !searching ? (
                <p className="py-4 text-center text-xs text-muted">Nie znaleziono uĹĽytkownikĂłw</p>
              ) : query.length > 0 && query.length < 2 ? (
                <p className="py-2 text-center text-xs text-muted">Wpisz co najmniej 2 znaki</p>
              ) : null}
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="znajomy@example.com"
                className="w-full rounded-xl border border-card-border bg-input-bg px-4 py-2.5 text-sm text-foreground placeholder-muted outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-card-border bg-card-bg py-2.5 text-sm font-medium text-muted transition hover:bg-input-bg">
                  Anuluj
                </button>
                <button type="submit" disabled={loading} className="flex flex-1 items-center justify-center rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-50">
                  {loading ? <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : 'WyĹ›lij zaproszenie'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
