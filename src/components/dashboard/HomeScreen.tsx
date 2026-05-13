'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSupabaseClient } from '@/lib/supabase-client';
import { useMapStore } from '@/stores/useMapStore';
import SpotifyWidget from '@/components/spotify/SpotifyWidget';
import { useWeather } from '@/hooks/useWeather';
import { timeAgo } from '@/lib/utils';
import { REPORT_TYPE_LABELS } from '@/types';
import XPBar from '@/components/gamification/XPBar';
import StreakWidget from '@/components/gamification/StreakWidget';
import AchievementUnlock from '@/components/gamification/AchievementUnlock';
import AchievementsPanel from '@/components/gamification/AchievementsPanel';
import Leaderboard from '@/components/gamification/Leaderboard';
import DailyChallenge from '@/components/dashboard/DailyChallenge';
import { getLevelInfo } from '@/lib/xp';

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
  activeConvoy: { id: string; name: string; role: string; memberCount: number } | null;
  pendingRequests: number;
  totalActiveReports: number;
  todayKm: number;
  todayMinutes: number;
  todayTripCount: number;
  weekKm: number;
}

interface XPData {
  total: number;
  level: number;
  levelName: string;
  nextLevel: { level: number; name: string; minXP: number } | null;
  progress: number;
  xpInLevel: number;
  xpNeeded: number;
  streak: { current: number; longest: number; lastActive: string | null };
  achievements: Array<{
    key: string; name: string; description: string; emoji: string;
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'; xpReward: number; unlockedAt: string;
  }>;
}

interface RecentReport {
  id: string;
  type: string;
  description?: string;
  createdAt: string;
  user: { name: string };
}

interface SuggestedRoute {
  id: string;
  name: string;
  description: string;
  distance: number;
  duration: number;
  type: 'scenic' | 'mountain' | 'coastal' | 'city' | 'countryside';
}

interface HomeScreenProps {
  onNavigateToMap: () => void;
  onNavigateToFriends: () => void;
  onNavigateToRoutes: () => void;
  onNavigateToConvoy: () => void;
}

const REPORT_LABELS: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  POLICE:          { label: REPORT_TYPE_LABELS.POLICE,          color: 'text-blue-400',   bg: 'bg-blue-500/15',   emoji: '🚔' },
  UNMARKED_POLICE: { label: REPORT_TYPE_LABELS.UNMARKED_POLICE, color: 'text-indigo-400', bg: 'bg-indigo-500/15', emoji: '🕵️' },
  SPEED_TRAP:      { label: REPORT_TYPE_LABELS.SPEED_TRAP,      color: 'text-yellow-400', bg: 'bg-yellow-500/15', emoji: '📏' },
  ACCIDENT:        { label: REPORT_TYPE_LABELS.ACCIDENT,        color: 'text-red-400',    bg: 'bg-red-500/15',    emoji: '🚨' },
  OBSTACLE:        { label: REPORT_TYPE_LABELS.OBSTACLE,        color: 'text-orange-400', bg: 'bg-orange-500/15', emoji: '⚠️' },
  SPEED_CAMERA:    { label: REPORT_TYPE_LABELS.SPEED_CAMERA,    color: 'text-purple-400', bg: 'bg-purple-500/15', emoji: '📷' },
};

function WeatherIcon({ code, isDay }: { code: number; isDay: boolean }) {
  if (code === 0) return isDay ? <span className="text-xl">☀️</span> : <span className="text-xl">🌙</span>;
  if (code <= 3)  return <span className="text-xl">⛅</span>;
  if (code <= 48) return <span className="text-xl">🌫️</span>;
  if (code <= 82) return <span className="text-xl">🌧️</span>;
  return <span className="text-xl">⛈️</span>;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6)  return 'Dobrej nocy';
  if (h < 12) return 'Dzień dobry';
  if (h < 18) return 'Cześć';
  return 'Dobry wieczór';
}

function StatPill({ emoji, value, label }: { emoji: string; value: string | number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-input-bg px-3 py-2.5 min-w-0">
      <span className="text-lg leading-none">{emoji}</span>
      <span className="text-base font-extrabold text-foreground tabular-nums leading-tight">{value}</span>
      <span className="text-[10px] text-muted leading-tight text-center">{label}</span>
    </div>
  );
}

function ShortcutTile({ onClick, label, sub, gradient, icon, badge }: {
  onClick: () => void; label: string; sub: string; gradient: string; icon: React.ReactNode; badge?: number;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={() => { navigator.vibrate?.(8); onClick(); }}
      className={`relative flex h-28 flex-col justify-between rounded-2xl bg-gradient-to-br ${gradient} p-3 text-left text-white shadow-lg transition hover:brightness-110`}
    >
      <div className="flex items-start justify-between">
        <span className="rounded-lg bg-white/20 p-1.5">{icon}</span>
        {badge && badge > 0 ? (
          <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-black text-foreground">{badge}</span>
        ) : null}
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[10px] font-medium text-white/80">{sub}</p>
      </div>
    </motion.button>
  );
}

const stagger = {
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 26 } },
};

export default function HomeScreen({
  onNavigateToMap, onNavigateToFriends, onNavigateToRoutes, onNavigateToConvoy,
}: HomeScreenProps) {
  const { data: session } = useSession();
  const userLocation = useMapStore((s) => s.userLocation);
  const speedKmh = userLocation?.speed != null && userLocation.speed >= 0
    ? Math.round(userLocation.speed * 3.6) : 0;

  const weather = useWeather(userLocation?.latitude, userLocation?.longitude);

  const [friends, setFriends]           = useState<OnlineFriend[]>([]);
  const [stats, setStats]               = useState<DashboardStats | null>(null);
  const [xpData, setXpData]             = useState<XPData | null>(null);
  const [reports, setReports]           = useState<RecentReport[]>([]);
  const [suggestedRoutes, setSuggested] = useState<SuggestedRoute[]>([]);
  const [loading, setLoading]           = useState(true);
  const [newAchievement, setNewAchievement] = useState<XPData['achievements'][number] | null>(null);
  const [notifState, setNotifState] = useState<'hidden' | 'prompt'>('hidden');
  const [notifRequesting, setNotifRequesting] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const seenAchievementsRef = useRef<Set<string>>(new Set());
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const dismissed = localStorage.getItem('driveapp_notif_dismissed');
    if (!dismissed && Notification.permission === 'default') {
      const timer = setTimeout(() => setNotifState('prompt'), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  async function requestNotifPermission() {
    setNotifRequesting(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted' && 'serviceWorker' in navigator) {
        navigator.vibrate?.(40);
      }
    } catch { /* silent */ }
    localStorage.setItem('driveapp_notif_dismissed', '1');
    setNotifRequesting(false);
    setNotifState('hidden');
  }

  function dismissNotifBanner() {
    localStorage.setItem('driveapp_notif_dismissed', '1');
    setNotifState('hidden');
  }

  const fetchReports = useCallback(async () => {
    const loc = userLocationRef.current;
    if (!loc) return;
    try {
      const res = await fetch(`/api/reports?lat=${loc.latitude}&lng=${loc.longitude}&radius=50`);
      if (res.ok) setReports((await res.json()).slice(0, 5));
    } catch { /* silent */ }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const loc = userLocationRef.current;
      const suggestedUrl = loc
        ? `/api/routes/suggested?lat=${loc.latitude}&lng=${loc.longitude}`
        : null;

      const requests: Promise<Response>[] = [
        fetch('/api/friends/online'),
        fetch('/api/dashboard/stats'),
        fetch('/api/xp'),
      ];
      if (suggestedUrl) requests.push(fetch(suggestedUrl));

      const [friendsRes, statsRes, xpRes, suggestedRes] = await Promise.all(requests);
      if (friendsRes.ok) setFriends(await friendsRes.json());
      if (statsRes.ok)   setStats(await statsRes.json());
      if (xpRes.ok) {
        const xp: XPData = await xpRes.json();
        setXpData(xp);
        const unseen = xp.achievements.find((a) => !seenAchievementsRef.current.has(a.key));
        if (unseen) {
          seenAchievementsRef.current.add(unseen.key);
          const age = Date.now() - new Date(unseen.unlockedAt).getTime();
          if (age < 60_000) setNewAchievement(unseen);
        }
      }
      if (suggestedRes?.ok) setSuggested(await suggestedRes.json());
      await fetchReports();
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [fetchReports]);

  useEffect(() => {
    fetchData();
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const ch = supabase.channel('home:public');
    ch.on('broadcast', { event: 'new-report' },  () => fetchReports())
      .on('broadcast', { event: 'report-vote' }, () => fetchReports())
      .subscribe();
    return () => { ch.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstName = session?.user?.name?.split(' ')[0] ?? 'Kierowco';
  const today = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
  const isActiveToday = xpData?.streak.lastActive
    ? new Date(xpData.streak.lastActive).toDateString() === new Date().toDateString()
    : false;

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Achievement unlock overlay */}
      <AchievementUnlock
        achievement={newAchievement}
        onDismiss={() => setNewAchievement(null)}
      />

      {/* All achievements overlay */}
      <AnimatePresence>
        {showAchievements && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="absolute inset-0 z-40 flex flex-col bg-background"
          >
            <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-card-border">
              <button
                onClick={() => setShowAchievements(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-card-bg border border-card-border text-muted transition hover:text-foreground"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-500/20 text-xl">
                🏅
              </div>
              <h2 className="flex-1 text-lg font-bold text-foreground">Kolekcja odznak</h2>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <AchievementsPanel />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto pb-28">
        <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4 px-5 pt-14 pb-2">

          {/* Greeting */}
          <motion.div variants={fadeUp}>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">{today}</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">
              {getGreeting()}, {firstName} {xpData && <span className="text-accent">⚡</span>}
            </h1>
          </motion.div>

          {/* XP Bar */}
          {xpData && (
            <motion.div variants={fadeUp}>
              <XPBar
                total={xpData.total}
                level={xpData.level}
                levelName={xpData.levelName}
                progress={xpData.progress}
                xpInLevel={xpData.xpInLevel}
                xpNeeded={xpData.xpNeeded}
                nextLevel={xpData.nextLevel}
              />
            </motion.div>
          )}

          {/* Daily challenge */}
          {stats && (
            <motion.div variants={fadeUp}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Wyzwanie dnia</p>
              </div>
              <DailyChallenge stats={{
                todayKm: stats.todayKm,
                todayTripCount: stats.todayTripCount,
                todayReports: stats.todayReports,
                streakCurrent: xpData?.streak.current ?? 0,
              }} />
            </motion.div>
          )}

          {/* Push notification permission banner */}
          {notifState === 'prompt' && (
            <motion.div variants={fadeUp}>
              <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/8 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Powiadomienia o trasie</p>
                  <p className="text-xs text-muted mt-0.5">Bądź na bieżąco z raportami w konwoju i zaproszeniami</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={requestNotifPermission}
                      disabled={notifRequesting}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      Włącz
                    </button>
                    <button
                      onClick={dismissNotifBanner}
                      className="rounded-lg border border-card-border px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                    >
                      Nie teraz
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Streak + Quick Stats row */}
          {(xpData || stats) && (
            <motion.div variants={fadeUp} className="grid grid-cols-4 gap-2">
              {xpData && (
                <div className="col-span-2">
                  <StreakWidget
                    currentStreak={xpData.streak.current}
                    longestStreak={xpData.streak.longest}
                    isActiveToday={isActiveToday}
                    compact
                  />
                </div>
              )}
              <StatPill emoji="🛣️" value={stats?.totalRoutes ?? '—'} label="Trasy" />
              <StatPill emoji="🚔" value={stats?.totalReports ?? '—'} label="Raporty" />
            </motion.div>
          )}

          {/* Weather */}
          {weather && (
            <motion.div variants={fadeUp}>
              <div className="flex items-center gap-3 rounded-2xl border border-card-border bg-card-bg px-4 py-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-input-bg">
                  <WeatherIcon code={weather.code} isDay={weather.isDay} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {weather.temp}°C
                    <span className="ml-2 text-xs font-normal text-muted">{weather.label}</span>
                  </p>
                  <p className="text-xs text-muted">Wiatr {weather.windKmh} km/h</p>
                </div>
                {speedKmh > 0 && (
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-accent text-white shrink-0">
                    <span className="text-lg font-bold leading-none tabular-nums">{speedKmh}</span>
                    <span className="text-[9px] font-medium opacity-80">km/h</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Spotify */}
          <motion.div variants={fadeUp}>
            <SpotifyWidget />
          </motion.div>

          {/* Map preview */}
          <motion.div variants={fadeUp}>
            <button
              onClick={onNavigateToMap}
              className="relative w-full overflow-hidden rounded-2xl border border-card-border bg-card-bg"
              style={{ height: 160 }}
            >
              <img
                src={`https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${
                  userLocation
                    ? `${userLocation.longitude},${userLocation.latitude},13`
                    : '19.9449,50.0647,10'
                },0/600x320@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`}
                alt="Podgląd mapy"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                <div className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 shadow-lg">
                  <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" /><path d="M8 2v16M16 6v16" />
                  </svg>
                  <span className="text-sm font-semibold text-white">Otwórz mapę</span>
                </div>
              </div>
            </button>
          </motion.div>

          {/* Active convoy banner */}
          {stats?.activeConvoy && (
            <motion.div variants={fadeUp}>
              <button
                onClick={onNavigateToConvoy}
                className="flex w-full items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left transition hover:bg-emerald-500/15"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="1" y="3" width="15" height="13" rx="2" />
                    <path d="M16 8h4l3 3v5a1 1 0 01-1 1h-2" />
                    <circle cx="5.5" cy="18.5" r="2.5" />
                    <circle cx="18.5" cy="18.5" r="2.5" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{stats.activeConvoy.name}</p>
                  <p className="text-xs text-muted">{stats.activeConvoy.memberCount} uczestników • Konwój aktywny</p>
                </div>
                <div className="flex h-2 w-2 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
              </button>
            </motion.div>
          )}

          {/* Today's drive widget */}
          {stats && (stats.todayKm > 0 || stats.todayTripCount > 0) && (
            <motion.div variants={fadeUp}>
              <div className="rounded-2xl border border-card-border bg-card-bg overflow-hidden">
                <div className="h-0.5 w-full bg-gradient-to-r from-accent to-orange-600" />
                <div className="px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Dzisiaj na drodze</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center">
                      <span className="text-xl font-extrabold text-accent tabular-nums">
                        {stats.todayKm.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-muted">km</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xl font-extrabold text-foreground tabular-nums">
                        {stats.todayMinutes < 60
                          ? `${stats.todayMinutes}m`
                          : `${Math.floor(stats.todayMinutes / 60)}h${stats.todayMinutes % 60 > 0 ? ` ${stats.todayMinutes % 60}m` : ''}`}
                      </span>
                      <span className="text-[10px] text-muted">czas</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xl font-extrabold text-foreground tabular-nums">
                        {stats.todayTripCount}
                      </span>
                      <span className="text-[10px] text-muted">{stats.todayTripCount === 1 ? 'podróż' : 'podróże'}</span>
                    </div>
                  </div>
                  {stats.weekKm > 0 && (
                    <p className="mt-2 text-[11px] text-muted text-center">
                      Ten tydzień: <span className="font-semibold text-foreground">{stats.weekKm.toFixed(0)} km</span>
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Shortcut tiles */}
          <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3">
            <ShortcutTile
              onClick={onNavigateToConvoy}
              label="Konwój"
              sub={stats?.activeConvoy ? `${stats.activeConvoy.memberCount} osób` : 'Jedź razem'}
              gradient="from-emerald-500 to-teal-700"
              icon={<svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="1" y="3" width="15" height="13" rx="2" /><path d="M16 8h4l3 3v5a1 1 0 01-1 1h-2" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>}
            />
            <ShortcutTile
              onClick={onNavigateToFriends}
              label="Znajomi"
              sub={stats?.pendingRequests ? `${stats.pendingRequests} zaproszeń` : 'Twoja paczka'}
              gradient="from-pink-500 to-rose-700"
              badge={stats?.pendingRequests ?? 0}
              icon={<svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>}
            />
            <ShortcutTile
              onClick={onNavigateToRoutes}
              label="Trasy"
              sub={stats?.totalRoutes ? `${stats.totalRoutes} zapisanych` : 'Zaplanuj jazdę'}
              gradient="from-accent to-orange-700"
              icon={<svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15" /><circle cx="18" cy="5" r="3" /></svg>}
            />
          </motion.div>

          {/* Suggested routes strip */}
          {suggestedRoutes.length > 0 && (
            <motion.div variants={fadeUp}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Polecane trasy</p>
                <button onClick={onNavigateToRoutes} className="text-xs font-medium text-accent hover:opacity-80">Wszystkie →</button>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                {suggestedRoutes.map((route) => {
                  const TYPE_EMOJI: Record<string, string> = {
                    scenic: '🌄', mountain: '⛰️', coastal: '🌊', city: '🏙️', countryside: '🌾',
                  };
                  return (
                    <button
                      key={route.id}
                      onClick={onNavigateToRoutes}
                      className="flex shrink-0 w-44 flex-col gap-2 rounded-2xl border border-card-border bg-card-bg p-3 text-left transition hover:border-accent/40"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{TYPE_EMOJI[route.type] ?? '🗺️'}</span>
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                          {route.distance.toFixed(0)} km
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{route.name}</p>
                        <p className="text-[11px] text-muted truncate mt-0.5">{route.description}</p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                        </svg>
                        {route.duration < 60 ? `${route.duration} min` : `${Math.floor(route.duration / 60)}h ${route.duration % 60}m`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Friend requests banner */}
          {stats && stats.pendingRequests > 0 && (
            <motion.div variants={fadeUp}>
              <button
                onClick={onNavigateToFriends}
                className="flex w-full items-center gap-3 rounded-2xl border border-pink-500/30 bg-pink-500/10 px-4 py-3 text-left transition hover:bg-pink-500/15"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-600 text-white shrink-0">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11h-6" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {stats.pendingRequests} zaproszeni{stats.pendingRequests === 1 ? 'e' : stats.pendingRequests < 5 ? 'a' : 'ń'}
                  </p>
                  <p className="text-xs text-muted">Ktoś chce Cię dodać do znajomych</p>
                </div>
                <svg className="h-4 w-4 text-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </motion.div>
          )}

          {/* Online friends */}
          {friends.length > 0 && (
            <motion.div variants={fadeUp}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Online znajomi</p>
                <button onClick={onNavigateToFriends} className="text-xs font-medium text-accent hover:opacity-80">Wszyscy</button>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                {friends.map((friend) => (
                  <div key={friend.id} className="relative shrink-0 flex flex-col items-center gap-1" title={friend.name}>
                    {friend.image ? (
                      <img src={friend.image} alt={friend.name} className={`h-11 w-11 rounded-full object-cover border-2 ${friend.isOnline ? 'border-emerald-500' : 'border-card-border opacity-50'}`} />
                    ) : (
                      <div className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-bold ${friend.isOnline ? 'border-emerald-500 bg-emerald-600/20 text-emerald-400' : 'border-card-border bg-card-bg text-muted opacity-50'}`}>
                        {friend.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className={`absolute bottom-5 right-0 h-3 w-3 rounded-full border-2 border-background ${friend.isDriving ? 'bg-accent' : friend.isOnline ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
                    <span className="text-[10px] text-muted truncate max-w-[48px]">{friend.name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Recent achievements strip */}
          {xpData && (
            <motion.div variants={fadeUp}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Odznaki</p>
                <button
                  onClick={() => setShowAchievements(true)}
                  className="text-xs font-medium text-accent hover:opacity-80"
                >
                  Wszystkie →
                </button>
              </div>
              {xpData.achievements.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                  {xpData.achievements.slice(0, 8).map((ach) => (
                    <div key={ach.key} className="flex shrink-0 flex-col items-center gap-1" title={ach.name}>
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-input-bg text-2xl border border-card-border">
                        {ach.emoji}
                      </div>
                      <span className="text-[9px] text-muted text-center truncate max-w-[48px]">{ach.name}</span>
                    </div>
                  ))}
                  <button
                    onClick={() => setShowAchievements(true)}
                    className="flex shrink-0 flex-col items-center gap-1"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-card-border text-muted text-lg">
                      +
                    </div>
                    <span className="text-[9px] text-muted">Więcej</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAchievements(true)}
                  className="flex w-full items-center gap-3 rounded-xl border border-dashed border-card-border px-4 py-3 text-left text-muted transition hover:border-accent/40"
                >
                  <span className="text-xl">🏅</span>
                  <span className="text-sm">Zacznij zbierać odznaki</span>
                </button>
              )}
            </motion.div>
          )}

          {/* Nearby reports */}
          {reports.length > 0 && (
            <motion.div variants={fadeUp}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Raporty w okolicy
                  <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[9px] font-bold text-white">
                    {reports.length}
                  </span>
                </h2>
                <button onClick={onNavigateToMap} className="text-xs font-medium text-accent hover:opacity-80">
                  Mapa →
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {reports.map((report) => {
                  const meta = REPORT_LABELS[report.type] ?? { label: report.type, color: 'text-zinc-400', bg: 'bg-zinc-500/15', emoji: '⚠️' };
                  return (
                    <div key={report.id} className="flex items-center gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg ${meta.bg}`}>
                        {meta.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{meta.label}</p>
                        <p className="text-xs text-muted truncate">{report.user.name} · {timeAgo(report.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {!loading && reports.length === 0 && (
            <motion.div variants={fadeUp}>
              <div className="rounded-2xl border border-card-border bg-card-bg px-4 py-6 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-500">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground">Czysto w okolicy</p>
                <p className="mt-0.5 text-xs text-muted">Brak raportów o zagrożeniach</p>
              </div>
            </motion.div>
          )}

          {/* Leaderboard */}
          {session?.user?.id && (
            <motion.div variants={fadeUp}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">🏆 Ranking tygodnia</p>
              <Leaderboard currentUserId={session.user.id} />
            </motion.div>
          )}

        </motion.div>
      </div>
    </div>
  );
}
