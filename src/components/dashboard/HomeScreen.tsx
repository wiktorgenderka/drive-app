'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import { useMapStore } from '@/stores/useMapStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useStatsStore } from '@/stores/useStatsStore';
import SpotifyWidget from '@/components/spotify/SpotifyWidget';
import { useWeather } from '@/hooks/useWeather';
import { timeAgo } from '@/lib/utils';
import { REPORT_TYPE_LABELS } from '@/types';

interface SpotifyNowPlaying {
  isPlaying: boolean;
  title: string;
  artist: string;
  albumArt: string;
}

interface OnlineFriend {
  id: string;
  name: string;
  email: string;
  image?: string;
  isOnline: boolean;
  isDriving: boolean;
  spotify?: SpotifyNowPlaying | null;
}

interface DashboardStats {
  totalRoutes: number;
  totalReports: number;
  todayReports: number;
  activeConvoy: {
    id: string;
    name: string;
    role: string;
    memberCount: number;
  } | null;
  pendingRequests: number;
  totalActiveReports: number;
}

interface RecentReport {
  id: string;
  type: string;
  description?: string;
  createdAt: string;
  user: { name: string };
}

interface HomeScreenProps {
  onNavigateToMap: () => void;
  onNavigateToFriends: () => void;
  onNavigateToRoutes: () => void;
  onNavigateToConvoy: () => void;
}

const REPORT_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  POLICE: { label: REPORT_TYPE_LABELS.POLICE, color: 'text-blue-400', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  UNMARKED_POLICE: { label: REPORT_TYPE_LABELS.UNMARKED_POLICE, color: 'text-indigo-400', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
  SPEED_TRAP: { label: REPORT_TYPE_LABELS.SPEED_TRAP, color: 'text-yellow-400', icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z' },
  ACCIDENT: { label: REPORT_TYPE_LABELS.ACCIDENT, color: 'text-red-400', icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
  OBSTACLE: { label: REPORT_TYPE_LABELS.OBSTACLE, color: 'text-orange-400', icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  SPEED_CAMERA: { label: REPORT_TYPE_LABELS.SPEED_CAMERA, color: 'text-purple-400', icon: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z' },
};

function WeatherIcon({ code, isDay }: { code: number; isDay: boolean }) {
  // sunny / clear — show sun during day, moon at night
  if (code === 0) return isDay ? (
    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ) : (
    <svg className="h-5 w-5 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
  // partly cloudy / cloudy
  if (code <= 3) return (
    <svg className="h-5 w-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    </svg>
  );
  // fog
  if (code <= 48) return (
    <svg className="h-5 w-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="3" y1="8" x2="21" y2="8"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="16" x2="21" y2="16"/>
    </svg>
  );
  // rain / drizzle
  if (code <= 82) return (
    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="16" y1="13" x2="16" y2="21"/><line x1="8" y1="13" x2="8" y2="21"/><line x1="12" y1="15" x2="12" y2="23"/>
      <path d="M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25" />
    </svg>
  );
  // snow
  if (code <= 77) return (
    <svg className="h-5 w-5 text-blue-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 16.25"/><line x1="8" y1="16" x2="8" y2="21"/><line x1="8" y1="21" x2="6" y2="19"/><line x1="8" y1="21" x2="10" y2="19"/>
    </svg>
  );
  // thunderstorm
  return (
    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M19 16.9A5 5 0 0018 7h-1.26a8 8 0 10-11.62 9" /><polyline points="13 11 9 17 15 17 11 23" />
    </svg>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Dobrej nocy';
  if (h < 12) return 'Dzień dobry';
  if (h < 18) return 'Cześć';
  return 'Dobry wieczór';
}

interface ShortcutTileProps {
  onClick: () => void;
  label: string;
  sub: string;
  gradient: string;
  icon: React.ReactNode;
  badge?: number;
}

function ShortcutTile({ onClick, label, sub, gradient, icon, badge }: ShortcutTileProps) {
  return (
    <button
      onClick={onClick}
      className={`relative flex h-28 flex-col justify-between rounded-2xl bg-gradient-to-br ${gradient} p-3 text-left text-white shadow-lg transition hover:brightness-110 active:scale-[0.98]`}
    >
      <div className="flex items-start justify-between">
        <span className="rounded-lg bg-white/20 p-1.5">{icon}</span>
        {badge && badge > 0 ? (
          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black text-foreground">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[10px] font-medium text-white/80">{sub}</p>
      </div>
    </button>
  );
}


export default function HomeScreen({
  onNavigateToMap,
  onNavigateToFriends,
  onNavigateToRoutes,
  onNavigateToConvoy,
}: HomeScreenProps) {
  const { data: session } = useSession();
  const userLocation = useMapStore((s) => s.userLocation);
  const { accentColor } = useThemeStore();
  const { overall } = useStatsStore();
  const speedKmh =
    userLocation?.speed != null && userLocation.speed >= 0
      ? Math.round(userLocation.speed * 3.6)
      : 0;

  const weather = useWeather(userLocation?.latitude, userLocation?.longitude);

  const [friends, setFriends] = useState<OnlineFriend[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<RecentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;

  const fetchReports = useCallback(async () => {
    const loc = userLocationRef.current;
    if (!loc) return;
    try {
      const res = await fetch(`/api/reports?lat=${loc.latitude}&lng=${loc.longitude}&radius=50`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.slice(0, 5));
      }
    } catch {
      // silent
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [friendsRes, statsRes] = await Promise.all([
        fetch('/api/friends/online'),
        fetch('/api/dashboard/stats'),
      ]);
      if (friendsRes.ok) setFriends(await friendsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      await fetchReports();
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [fetchReports]);

  // Initial fetch + socket subscription for real-time updates
  useEffect(() => {
    fetchData();

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    // Re-fetch nearby reports when a new report is broadcast
    socket.on('new-report', () => { fetchReports(); });
    // Re-fetch stats when a report vote changes
    socket.on('report-vote', () => { fetchReports(); });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstName = session?.user?.name?.split(' ')[0] ?? 'Kierowco';

  const now = new Date();
  const dateStr = now.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Header */}
        <div className="px-5 pt-14 pb-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            {dateStr}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">
            {getGreeting()}, {firstName}
          </h1>
        </div>

        {/* Weather widget */}
        {weather && (
          <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-card-border bg-card-bg px-4 py-3">
            {/* Weather icon */}
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-input-bg text-foreground">
              <WeatherIcon code={weather.code} isDay={weather.isDay} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {weather.temp}°C
                <span className="ml-2 text-xs font-normal text-muted">{weather.label}</span>
              </p>
              <p className="text-xs text-muted">Wiatr {weather.windKmh} km/h</p>
            </div>
          </div>
        )}

        {/* Speed pill - only when moving */}
        {speedKmh > 0 && (
          <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
            <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-blue-600 text-white">
              <span className="text-lg font-bold leading-none">{speedKmh}</span>
              <span className="text-[9px] font-medium opacity-80">km/h</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Jesteś w trasie</p>
              <p className="text-xs text-muted">
                Jazda aktywna
                {userLocation?.accuracy != null && (
                  <span className="ml-1 text-[10px] opacity-70">
                    • GPS ±{Math.round(userLocation.accuracy)} m
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onNavigateToMap}
              className="ml-auto rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              Mapa
            </button>
          </div>
        )}

        {/* Spotify now playing */}
        <SpotifyWidget />

        {/* Map preview */}
        <div className="mx-5 mt-5">
          <button
            onClick={onNavigateToMap}
            className="relative w-full overflow-hidden rounded-2xl border border-card-border bg-card-bg"
            style={{ height: 180 }}
          >
            {userLocation ? (
              <img
                src={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${userLocation.longitude},${userLocation.latitude},13,0/600x360@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
                alt="Podgląd mapy"
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/19.9449,50.0647,10,0/600x360@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
                alt="Podgląd mapy"
                className="h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 shadow-lg">
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
                  <path d="M8 2v16M16 6v16" />
                </svg>
                <span className="text-sm font-semibold text-white">Otwórz mapę</span>
              </div>
            </div>
          </button>
        </div>

        {/* Skróty: Konwój / Znajomi / Trasy */}
        <div className="mx-5 mt-4 grid grid-cols-3 gap-3">
          <ShortcutTile
            onClick={onNavigateToConvoy}
            label="Konwój"
            sub={stats?.activeConvoy ? `${stats.activeConvoy.memberCount} osób` : 'Jedź razem'}
            gradient="from-emerald-500 to-teal-700"
            icon={(
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="1" y="3" width="15" height="13" rx="2" />
                <path d="M16 8h4l3 3v5a1 1 0 01-1 1h-2" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            )}
          />
          <ShortcutTile
            onClick={onNavigateToFriends}
            label="Znajomi"
            sub={stats?.pendingRequests ? `${stats.pendingRequests} zaproszeń` : 'Twoja paczka'}
            gradient="from-pink-500 to-rose-700"
            badge={stats?.pendingRequests ?? 0}
            icon={(
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            )}
          />
          <ShortcutTile
            onClick={onNavigateToRoutes}
            label="Trasy"
            sub={stats?.totalRoutes ? `${stats.totalRoutes} zapisanych` : 'Zaplanuj jazdę'}
            gradient="from-orange-500 to-amber-700"
            icon={(
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="6" cy="19" r="3" />
                <path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15" />
                <circle cx="18" cy="5" r="3" />
              </svg>
            )}
          />
        </div>

        {/* Pending friend requests badge */}
        {stats && stats.pendingRequests > 0 && (
          <button
            onClick={onNavigateToFriends}
            className="mx-5 mt-3 flex items-center gap-3 rounded-2xl border border-pink-500/30 bg-pink-500/10 px-4 py-3 text-left transition hover:bg-pink-500/15"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-600 text-white">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <path d="M20 8v6M23 11h-6" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {stats.pendingRequests} zaproszeni{stats.pendingRequests === 1 ? 'e' : stats.pendingRequests < 5 ? 'a' : 'ń'}
              </p>
              <p className="text-xs text-muted">Ktoś chce Cię dodać do znajomych</p>
            </div>
            <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        )}

        {/* Online friends */}
        {friends.length > 0 && (
          <div className="mt-5 flex items-center gap-2 px-5">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {friends.map((friend) => (
                <div key={friend.id} className="relative shrink-0" title={friend.name}>
                  {friend.image ? (
                    <img
                      src={friend.image}
                      alt={friend.name}
                      className={`h-9 w-9 rounded-full object-cover border-2 ${
                        friend.isOnline ? 'border-green-500' : 'border-card-border opacity-50'
                      }`}
                    />
                  ) : (
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                      friend.isOnline ? 'border-green-500 bg-green-600/20 text-green-400' : 'border-card-border bg-card-bg text-muted opacity-50'
                    }`}>
                      {friend.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background ${
                    friend.isDriving ? 'bg-blue-500' : friend.isOnline ? 'bg-green-500' : 'bg-zinc-600'
                  }`} />
                </div>
              ))}
            </div>
            <button onClick={onNavigateToFriends} className="ml-auto shrink-0 text-xs font-medium text-blue-500 hover:text-blue-400">
              Wszyscy
            </button>
          </div>
        )}

        {/* Stats cards */}
        <div className="mx-5 mt-6 grid grid-cols-2 gap-3">
          {[
            { label: 'Dystans', value: `${overall.totalKm.toFixed(1)} km` },
            { label: 'Max prędkość', value: `${Math.round(overall.maxSpeedKmh)} km/h` },
            { label: 'Przejazdy', value: String(overall.totalTrips) },
            { label: 'Czas jazdy', value: overall.totalMinutes >= 60
              ? `${Math.floor(overall.totalMinutes / 60)}h ${overall.totalMinutes % 60}m`
              : `${overall.totalMinutes} min` },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-card-border bg-card-bg p-3">
              <p className="text-xl font-bold" style={{ color: accentColor }}>{s.value}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Nearby reports */}
        {reports.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between px-5 mb-3">
              <h2 className="text-sm font-semibold text-foreground">
                Raporty w okolicy
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1.5 text-[10px] font-bold text-white">
                  {reports.length}
                </span>
              </h2>
              <button
                onClick={onNavigateToMap}
                className="text-xs font-medium text-blue-500 transition hover:text-blue-400"
              >
                Zobacz na mapie
              </button>
            </div>
            <div className="flex flex-col gap-2 px-5">
              {reports.map((report) => {
                const meta = REPORT_LABELS[report.type] ?? {
                  label: report.type,
                  color: 'text-zinc-400',
                  icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                };
                return (
                  <div
                    key={report.id}
                    className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3"
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card-bg ${meta.color}`}>
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d={meta.icon} />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{meta.label}</p>
                      <p className="text-xs text-muted">
                        {report.user.name} &middot; {timeAgo(report.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state for no reports */}
        {!loading && reports.length === 0 && (
          <div className="mx-5 mt-6 rounded-2xl border border-card-border bg-card-bg px-4 py-6 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-500">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">Czysto w okolicy</p>
            <p className="mt-0.5 text-xs text-muted">Brak raportów o zagrożeniach</p>
          </div>
        )}
      </div>
    </div>
  );
}
