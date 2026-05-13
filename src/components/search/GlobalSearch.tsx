'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserResult { id: string; name: string; image: string | null; carDisplay: string | null }
interface RouteResult { id: string; name: string; description: string | null; avgRating: number | null; user: { name: string } }

type SearchResult =
  | { kind: 'user'; data: UserResult }
  | { kind: 'route'; data: RouteResult };

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  onShowProfile?: (userId: string) => void;
  onShowRoute?: (routeId: string) => void;
}

export default function GlobalSearch({ open, onClose, onShowProfile, onShowRoute }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setActiveIdx(-1);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Reset active index when results change
  useEffect(() => { setActiveIdx(-1); }, [results]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [usersRes, routesRes] = await Promise.all([
        fetch(`/api/users/search?q=${encodeURIComponent(q)}&limit=5`),
        fetch(`/api/routes/public?q=${encodeURIComponent(q)}&limit=5`),
      ]);
      const users: UserResult[] = usersRes.ok ? (await usersRes.json()).data ?? [] : [];
      const routes: RouteResult[] = routesRes.ok ? (await routesRes.json()).data ?? [] : [];
      const combined: SearchResult[] = [
        ...users.map((u): SearchResult => ({ kind: 'user', data: u })),
        ...routes.map((r): SearchResult => ({ kind: 'route', data: r })),
      ];
      setResults(combined);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  function handleChange(q: string) {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(q), 280);
  }

  function handleSelect(result: SearchResult) {
    if (result.kind === 'user') onShowProfile?.(result.data.id);
    if (result.kind === 'route') onShowRoute?.(result.data.id);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { onClose(); return; }
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < results.length) {
        handleSelect(results[activeIdx]);
      }
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-result-item]');
    items[activeIdx]?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // Flat list of results (users first, then routes) for keyboard nav
  const flatResults = results;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-[10vh] z-50 w-[min(92vw,520px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-card-border bg-card-bg shadow-2xl"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-card-border px-4 py-3.5">
              <svg className="h-5 w-5 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Szukaj kierowców, tras…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
              />
              {loading && (
                <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
              )}
              <kbd className="hidden rounded-md border border-card-border px-1.5 py-0.5 text-[11px] text-muted sm:block">
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
              {query.length < 2 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <span className="text-3xl">🔍</span>
                  <p className="text-sm text-muted">Wpisz min. 2 znaki</p>
                  <p className="text-xs text-muted/60">Szukaj kierowców lub tras</p>
                </div>
              )}

              {query.length >= 2 && !loading && results.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10">
                  <span className="text-3xl">😔</span>
                  <p className="text-sm text-muted">Brak wyników dla „{query}"</p>
                </div>
              )}

              {results.length > 0 && (
                <div className="py-2">
                  {/* Group by type */}
                  {flatResults.some((r) => r.kind === 'user') && (
                    <>
                      <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Kierowcy
                      </p>
                      {flatResults.filter((r): r is { kind: 'user'; data: UserResult } => r.kind === 'user').map((r) => {
                        const idx = flatResults.indexOf(r);
                        return (
                          <button
                            key={r.data.id}
                            data-result-item
                            onClick={() => handleSelect(r)}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                              activeIdx === idx ? 'bg-input-bg' : 'hover:bg-input-bg'
                            }`}
                          >
                            {r.data.image ? (
                              <img src={r.data.image} alt="" className="h-9 w-9 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
                                {r.data.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground">{r.data.name}</p>
                              {r.data.carDisplay && (
                                <p className="text-xs text-muted truncate">{r.data.carDisplay}</p>
                              )}
                            </div>
                            <svg className="ml-auto h-4 w-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </button>
                        );
                      })}
                    </>
                  )}

                  {flatResults.some((r) => r.kind === 'route') && (
                    <>
                      <p className="mt-1 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Trasy publiczne
                      </p>
                      {flatResults.filter((r): r is { kind: 'route'; data: RouteResult } => r.kind === 'route').map((r) => {
                        const idx = flatResults.indexOf(r);
                        return (
                          <button
                            key={r.data.id}
                            data-result-item
                            onClick={() => handleSelect(r)}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                              activeIdx === idx ? 'bg-input-bg' : 'hover:bg-input-bg'
                            }`}
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-lg">
                              🗺️
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground truncate">{r.data.name}</p>
                              <p className="text-xs text-muted">
                                {r.data.user.name}
                                {r.data.avgRating && (
                                  <span className="ml-2">⭐ {r.data.avgRating.toFixed(1)}</span>
                                )}
                              </p>
                            </div>
                            <svg className="ml-auto h-4 w-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="border-t border-card-border px-4 py-2 flex items-center gap-4 text-[11px] text-muted/60">
              <span><kbd className="rounded border border-card-border px-1">↑↓</kbd> nawiguj</span>
              <span><kbd className="rounded border border-card-border px-1">↵</kbd> wybierz</span>
              <span><kbd className="rounded border border-card-border px-1">Esc</kbd> zamknij</span>
              <span className="ml-auto">Ctrl+K</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
