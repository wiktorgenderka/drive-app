'use client';

import { useCallback, useEffect, useState } from 'react';
import ReportAbuseButton from '@/components/ui/ReportAbuseButton';

function formatTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface MiniProfileUser {
  id: string;
  name: string;
  image?: string | null;
  carDisplay?: string | null;
}

export interface MiniProfileContext {
  routeName?: string;
  seconds?: number;
  position?: number;
}

interface MiniProps {
  open: boolean;
  user: MiniProfileUser | null;
  context?: MiniProfileContext;
  onClose: () => void;
  onOpenFull: (userId: string) => void;
}

export function MiniProfileModal({ open, user, context, onClose, onOpenFull }: MiniProps) {
  if (!open || !user) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-card-border bg-card-bg p-5 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-input-bg ring-2 ring-orange-500/40">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted">
                {user.name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-foreground">{user.name}</p>
            {user.carDisplay ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <svg className="h-3.5 w-3.5 shrink-0 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                <span className="truncate">{user.carDisplay}</span>
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] italic text-muted">Brak informacji o pojeździe</p>
            )}
          </div>
        </div>

        {context && (context.routeName || context.seconds !== undefined) && (
          <div className="mt-4 rounded-xl bg-input-bg px-3 py-2.5">
            {context.routeName && (
              <p className="text-[11px] uppercase tracking-wider text-muted">Trasa</p>
            )}
            {context.routeName && (
              <p className="truncate text-sm font-semibold text-foreground">{context.routeName}</p>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs">
              {context.seconds !== undefined && (
                <span className="flex items-center gap-1 text-orange-400">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                  </svg>
                  <span className="font-mono font-bold tabular-nums">{formatTime(context.seconds)}</span>
                </span>
              )}
              {context.position !== undefined && (
                <span className="text-muted">#{context.position}</span>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-card-border bg-card-bg py-2 text-xs font-semibold text-muted transition hover:bg-input-bg hover:text-foreground"
          >
            Zamknij
          </button>
          <button
            onClick={() => onOpenFull(user.id)}
            className="flex-1 rounded-xl bg-orange-600 py-2 text-xs font-semibold text-white transition hover:bg-orange-700"
          >
            Pełny profil
          </button>
        </div>
      </div>
    </div>
  );
}

type FriendshipState = 'self' | 'friend' | 'pending_out' | 'pending_in' | 'rejected' | 'none';

type AchievementIcon = 'trophy' | 'medal' | 'star' | 'flame' | 'route' | 'calendar' | 'thumbs' | 'speed';

interface Achievement {
  id: string;
  label: string;
  hint: string;
  icon: AchievementIcon;
  tier: 'bronze' | 'silver' | 'gold';
}

interface PublicProfilePayload {
  user: {
    id: string;
    name: string;
    image: string | null;
    carDisplay: string | null;
    bio: string | null;
    createdAt: string;
  };
  stats: {
    totalRoutes: number;
    totalAttempts: number;
    podiums: number;
    wins: number;
    publishedRoutes: number;
    avgRouteRating: number | null;
    totalRatingsReceived: number;
  };
  tripStats: {
    tripCount: number;
    totalKm: number;
    totalMinutes: number;
    maxSpeedKmh: number;
    avgSpeedKmh: number;
  };
  records: { routeId: string; routeName: string; bestSeconds: number; attempts: number; position: number }[];
  publishedRoutes: {
    id: string;
    name: string;
    avgRating: number | null;
    ratingCount: number;
    publishedAt: string | null;
    _count: { times: number; imports: number };
  }[];
  achievements: Achievement[];
  friendship: FriendshipState;
  friendshipId: string | null;
}

interface ViewProps {
  userId: string;
  onBack?: () => void;
}

const TIER_STYLES: Record<Achievement['tier'], string> = {
  gold: 'border-yellow-400/40 bg-gradient-to-br from-yellow-500/20 to-amber-700/10 text-yellow-300',
  silver: 'border-slate-300/30 bg-gradient-to-br from-slate-300/15 to-slate-500/10 text-slate-200',
  bronze: 'border-amber-700/40 bg-gradient-to-br from-amber-700/20 to-orange-900/10 text-amber-400',
};

function AchievementIcon({ icon, className = 'h-4 w-4' }: { icon: AchievementIcon; className?: string }) {
  const common = { className, viewBox: '0 0 24 24', fill: 'currentColor' as const };
  switch (icon) {
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M7 3h10v3a5 5 0 01-10 0V3zm10 0h3v2a3 3 0 01-3 3V3zm-10 0H4v2a3 3 0 003 3V3zm-1 16h12v2H6v-2zm5-7h2v6h-2z" />
        </svg>
      );
    case 'medal':
      return (
        <svg {...common}>
          <path d="M12 15a5 5 0 100-10 5 5 0 000 10zm-3 1l1 5 2-1 2 1 1-5a7 7 0 01-6 0z" />
        </svg>
      );
    case 'star':
      return <svg {...common}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" /></svg>;
    case 'flame':
      return <svg {...common}><path d="M12 2c2 4-2 6 0 10 1 2 4 2 4 5a6 6 0 11-12 0c0-3 2-3 2-7 2 2 4 0 6-8z" /></svg>;
    case 'route':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="6" cy="19" r="3" />
          <path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15" />
          <circle cx="18" cy="5" r="3" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case 'thumbs':
      return <svg {...common}><path d="M2 21h4V9H2v12zM23 10c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>;
    case 'speed':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path d="M12 12l4-4" />
        </svg>
      );
  }
}

function formatKm(km: number): string {
  if (km >= 1000) return `${(km / 1000).toFixed(1)} tys. km`;
  return `${km.toFixed(1)} km`;
}

function formatHours(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

export function UserProfileView({ userId, onBack }: ViewProps) {
  const [data, setData] = useState<PublicProfilePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'records' | 'routes' | 'stats'>('records');
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const reload = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    setError('');
    fetch(`/api/users/${userId}/public`)
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d: PublicProfilePayload) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setData(null);
    setTab('records');
    reload();
    fetch(`/api/users/${userId}/block`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setIsBlocked(d.blocked); })
      .catch(() => {});
  }, [userId, reload]);

  async function handleFriendAction() {
    if (!data) return;
    setFriendActionLoading(true);
    try {
      if (data.friendship === 'none' || data.friendship === 'rejected') {
        const res = await fetch('/api/friends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.user.id }),
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b?.error ?? `HTTP ${res.status}`);
        }
      } else if (data.friendship === 'pending_in' && data.friendshipId) {
        const res = await fetch('/api/friends', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ friendshipId: data.friendshipId, action: 'accept' }),
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b?.error ?? `HTTP ${res.status}`);
        }
      }
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd akcji znajomych.');
    } finally {
      setFriendActionLoading(false);
    }
  }

  async function handleBlock() {
    setBlockLoading(true);
    try {
      const method = isBlocked ? 'DELETE' : 'POST';
      const res = await fetch(`/api/users/${userId}/block`, { method });
      if (res.ok) {
        const d = await res.json();
        setIsBlocked(d.blocked);
        if (d.blocked) reload();
      }
    } finally {
      setBlockLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card-bg shadow-sm">
      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="h-6 w-6 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : error ? (
        <div className="p-5">
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          {onBack && (
            <button onClick={onBack} className="mt-3 text-xs text-muted hover:text-foreground">
              ← Wróć
            </button>
          )}
        </div>
      ) : data ? (
        <>
          {/* Header banner */}
          <div className="relative h-32 bg-gradient-to-br from-orange-600 via-rose-600 to-violet-700" />

          <div className="relative px-5 pb-6 sm:px-7">
            {/* Avatar */}
            <div className="-mt-12 flex items-end justify-between">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-card-bg bg-input-bg shadow-xl">
                  {data.user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.user.image} alt={data.user.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted">
                      {data.user.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>
                {data.friendship !== 'self' && (
                  <div className="flex items-center gap-2">
                    <FriendButton state={data.friendship} loading={friendActionLoading} onClick={handleFriendAction} />
                    <button
                      onClick={handleBlock}
                      disabled={blockLoading}
                      title={isBlocked ? 'Odblokuj użytkownika' : 'Zablokuj użytkownika'}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                        isBlocked
                          ? 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'border-card-border bg-input-bg text-muted hover:text-red-400 hover:border-red-500/40'
                      }`}
                    >
                      {blockLoading ? (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="10" />
                          <path d="M4.93 4.93l14.14 14.14" />
                        </svg>
                      )}
                    </button>
                    <ReportAbuseButton targetType="profile" targetId={data.user.id} />
                  </div>
                )}
              </div>

              {/* Identity */}
              <div className="mt-3">
                <p className="text-xl font-bold text-foreground">{data.user.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {data.user.carDisplay && (
                    <span className="flex items-center gap-1">
                      <svg className="h-3.5 w-3.5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4z" />
                      </svg>
                      {data.user.carDisplay}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    Od {new Date(data.user.createdAt).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
                  </span>
                  {data.stats.avgRouteRating !== null && (
                    <span className="flex items-center gap-1 text-yellow-400">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                      </svg>
                      {data.stats.avgRouteRating.toFixed(2)} ({data.stats.totalRatingsReceived})
                    </span>
                  )}
                </div>
              </div>

              {data.user.bio && (
                <p className="mt-3 rounded-xl border border-card-border bg-input-bg px-3 py-2 text-xs leading-5 text-foreground">
                  {data.user.bio}
                </p>
              )}

              {/* Achievements */}
              {data.achievements.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Osiągnięcia</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.achievements.map((a) => (
                      <span
                        key={a.id}
                        title={a.hint}
                        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${TIER_STYLES[a.tier]}`}
                      >
                        <AchievementIcon icon={a.icon} className="h-3.5 w-3.5" />
                        {a.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="mt-4 flex gap-1 rounded-xl bg-input-bg p-1">
                {([
                  ['records', 'Rekordy'],
                  ['routes', `Trasy (${data.stats.publishedRoutes})`],
                  ['stats', 'Statystyki'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition ${
                      tab === id ? 'bg-card-bg text-foreground shadow-sm' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-3">
                {tab === 'records' && (
                  data.records.length === 0 ? (
                    <p className="rounded-xl bg-input-bg px-3 py-3 text-center text-xs text-muted">
                      Brak rekordów na publicznych trasach
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-1.5">
                      {data.records.map((r) => (
                        <li key={r.routeId} className="flex items-center gap-2.5 rounded-xl bg-input-bg px-3 py-2">
                          <span className={`w-7 text-center text-sm font-bold ${
                            r.position === 1 ? 'text-yellow-400' :
                            r.position === 2 ? 'text-slate-300' :
                            r.position === 3 ? 'text-amber-600' : 'text-muted'
                          }`}>
                            #{r.position}
                          </span>
                          <span className="flex-1 truncate text-xs font-medium text-foreground">{r.routeName}</span>
                          <span className="font-mono text-xs font-bold text-orange-400 tabular-nums">{formatTime(r.bestSeconds)}</span>
                        </li>
                      ))}
                    </ol>
                  )
                )}

                {tab === 'routes' && (
                  data.publishedRoutes.length === 0 ? (
                    <p className="rounded-xl bg-input-bg px-3 py-3 text-center text-xs text-muted">
                      Brak publicznych tras
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-1.5">
                      {data.publishedRoutes.map((r) => (
                        <li key={r.id} className="flex items-center gap-2.5 rounded-xl bg-input-bg px-3 py-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <circle cx="12" cy="12" r="10" />
                              <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-foreground">{r.name}</p>
                            <p className="text-[10px] text-muted">
                              {r._count.times} przejazdów • {r._count.imports} importów
                            </p>
                          </div>
                          {r.ratingCount > 0 ? (
                            <span className="flex items-center gap-1 rounded-md bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                              </svg>
                              {(r.avgRating ?? 0).toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted">—</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  )
                )}

                {tab === 'stats' && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-4 gap-2">
                      <Stat label="Rekordy" value={data.stats.totalRoutes} />
                      <Stat label="Próby" value={data.stats.totalAttempts} />
                      <Stat label="Podia" value={data.stats.podiums} />
                      <Stat label="Złota" value={data.stats.wins} accent />
                    </div>
                    <div className="rounded-xl border border-card-border bg-input-bg p-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Statystyki podróży</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <Row label="Łączny dystans" value={formatKm(data.tripStats.totalKm)} />
                        <Row label="Czas w drodze" value={formatHours(data.tripStats.totalMinutes)} />
                        <Row label="Max prędkość" value={`${Math.round(data.tripStats.maxSpeedKmh)} km/h`} />
                        <Row label="Średnia prędkość" value={`${data.tripStats.avgSpeedKmh.toFixed(1)} km/h`} />
                        <Row label="Liczba przejazdów" value={String(data.tripStats.tripCount)} />
                        <Row label="Trasy publiczne" value={String(data.stats.publishedRoutes)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
        </>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl px-2 py-2 text-center ${accent ? 'bg-orange-600/15' : 'bg-input-bg'}`}>
      <p className={`text-base font-bold ${accent ? 'text-orange-400' : 'text-foreground'}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

function FriendButton({
  state,
  loading,
  onClick,
}: {
  state: FriendshipState;
  loading: boolean;
  onClick: () => void;
}) {
  if (state === 'self') return null;
  const config = (() => {
    switch (state) {
      case 'friend':
        return { label: 'Znajomi', cls: 'bg-emerald-600/20 text-emerald-400 cursor-default', disabled: true };
      case 'pending_out':
        return { label: 'Wysłano', cls: 'bg-input-bg text-muted cursor-default', disabled: true };
      case 'pending_in':
        return { label: 'Akceptuj zaproszenie', cls: 'bg-accent text-accent-fg hover:opacity-90', disabled: false };
      default:
        return { label: '+ Dodaj znajomego', cls: 'bg-accent text-accent-fg hover:opacity-90', disabled: false };
    }
  })();
  return (
    <button
      onClick={onClick}
      disabled={loading || config.disabled}
      className={`mb-1 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-70 ${config.cls}`}
    >
      {loading ? '…' : config.label}
    </button>
  );
}
