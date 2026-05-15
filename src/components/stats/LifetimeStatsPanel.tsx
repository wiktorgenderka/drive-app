'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import WeeklyChart from './WeeklyChart';
import TripCalendar from './TripCalendar';

interface LifetimeStats {
  totalKm: number;
  totalMinutes: number;
  totalTrips: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  longestTripKm: number;
  fastestTripSpeed: number;
  totalReports: number;
  totalRoutes: number;
  totalFriends: number;
  totalConvoys: number;
  totalSpots: number;
  totalPosts: number;
  totalXP: number;
  memberSince: string | null;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h ${minutes % 60}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

function StatCard({ emoji, value, label, accent = false }: {
  emoji: string; value: string; label: string; accent?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-2xl border p-4 ${accent ? 'border-accent/30 bg-accent/5' : 'border-card-border bg-card-bg'}`}>
      <span className="text-2xl">{emoji}</span>
      <span className={`text-lg font-extrabold tabular-nums ${accent ? 'text-accent' : 'text-foreground'}`}>
        {value}
      </span>
      <span className="text-[10px] text-muted text-center leading-tight">{label}</span>
    </div>
  );
}

export default function LifetimeStatsPanel() {
  const [stats, setStats] = useState<LifetimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/stats/lifetime')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => { setStats(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-card-border bg-card-bg px-6 py-10 text-center">
        <span className="text-3xl">đź“Š</span>
        <p className="text-sm font-semibold text-foreground">Nie moĹĽna zaĹ‚adowaÄ‡ statystyk</p>
        <p className="text-xs text-muted">SprawdĹş poĹ‚Ä…czenie i sprĂłbuj ponownie</p>
        <button
          onClick={() => { setError(false); setLoading(true); fetch('/api/stats/lifetime').then((r) => r.ok ? r.json() : Promise.reject()).then((data) => { setStats(data); setLoading(false); }).catch(() => { setError(true); setLoading(false); }); }}
          className="mt-1 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-fg transition hover:opacity-90"
        >
          OdĹ›wieĹĽ
        </button>
      </div>
    );
  }

  const memberSinceStr = stats.memberSince
    ? new Date(stats.memberSince).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const DRIVING: { emoji: string; value: string; label: string; accent?: boolean }[] = [
    { emoji: 'đź›Łď¸Ź', value: `${stats.totalKm.toFixed(0)} km`, label: 'ĹÄ…czny dystans', accent: true },
    { emoji: 'âŹ±ď¸Ź', value: formatDuration(stats.totalMinutes), label: 'ĹÄ…czny czas' },
    { emoji: 'đźš—', value: String(stats.totalTrips), label: 'PodrĂłĹĽe' },
    { emoji: 'đź“Š', value: stats.avgSpeedKmh > 0 ? `${stats.avgSpeedKmh} km/h` : 'â€”', label: 'Ĺšr. prÄ™dkoĹ›Ä‡' },
    { emoji: 'đźš€', value: stats.maxSpeedKmh > 0 ? `${stats.maxSpeedKmh} km/h` : 'â€”', label: 'Maks. prÄ™dkoĹ›Ä‡', accent: stats.maxSpeedKmh > 150 },
    { emoji: 'đź’Ż', value: stats.longestTripKm > 0 ? `${stats.longestTripKm.toFixed(1)} km` : 'â€”', label: 'NajdĹ‚uĹĽsza trasa' },
  ];

  const ACTIVITY: { emoji: string; value: string; label: string }[] = [
    { emoji: 'đźš¨', value: String(stats.totalReports), label: 'Raporty' },
    { emoji: 'đź—şď¸Ź', value: String(stats.totalRoutes), label: 'Trasy stworzone' },
    { emoji: 'đź‘Ą', value: String(stats.totalConvoys), label: 'Konwoje' },
    { emoji: 'đź¤ť', value: String(stats.totalFriends), label: 'Znajomi' },
    { emoji: 'đź“Ť', value: String(stats.totalSpots), label: 'Spoty' },
    { emoji: 'đź“ť', value: String(stats.totalPosts), label: 'Posty' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Weekly chart */}
      <WeeklyChart />

      {/* Activity calendar */}
      <TripCalendar />

      {/* Header */}
      <div className="flex items-center gap-4 rounded-2xl border border-accent/30 bg-accent/8 px-4 py-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/20 text-3xl">
          âšˇ
        </div>
        <div>
          <p className="text-2xl font-extrabold text-accent tabular-nums">
            {stats.totalXP.toLocaleString('pl-PL')} XP
          </p>
          {memberSinceStr && (
            <p className="text-xs text-muted mt-0.5">UĹĽytkownik od {memberSinceStr}</p>
          )}
        </div>
      </div>

      {/* Driving stats */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">Statystyki jazdy</p>
        <motion.div
          className="grid grid-cols-2 gap-3"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {DRIVING.map((s) => (
            <motion.div key={s.label} variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
              <StatCard {...s} />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Activity stats */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">AktywnoĹ›Ä‡</p>
        <motion.div
          className="grid grid-cols-3 gap-3"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05, delayChildren: 0.3 } } }}
        >
          {ACTIVITY.map((s) => (
            <motion.div key={s.label} variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}>
              <StatCard {...s} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
