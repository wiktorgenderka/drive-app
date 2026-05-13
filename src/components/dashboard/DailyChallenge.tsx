'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface Challenge {
  emoji: string;
  title: string;
  description: string;
  xpReward: number;
  check: (stats: ChallengeStats) => { current: number; target: number };
}

interface ChallengeStats {
  todayKm: number;
  todayTripCount: number;
  todayReports: number;
  streakCurrent: number;
}

interface DailyChallengeProps {
  stats: ChallengeStats;
}

const CHALLENGES: Challenge[] = [
  {
    emoji: '🛣️',
    title: 'Dzienna trasówka',
    description: 'Przejedź 20 km dzisiaj',
    xpReward: 150,
    check: (s) => ({ current: s.todayKm, target: 20 }),
  },
  {
    emoji: '🚨',
    title: 'Strażnik dróg',
    description: 'Dodaj 2 raporty drogowe',
    xpReward: 80,
    check: (s) => ({ current: s.todayReports, target: 2 }),
  },
  {
    emoji: '🏁',
    title: 'Podróżnik',
    description: 'Ukończ 2 podróże',
    xpReward: 100,
    check: (s) => ({ current: s.todayTripCount, target: 2 }),
  },
  {
    emoji: '🔥',
    title: 'Utrzymaj streak',
    description: 'Bądź aktywny przez 3 dni z rzędu',
    xpReward: 200,
    check: (s) => ({ current: s.streakCurrent, target: 3 }),
  },
  {
    emoji: '🌄',
    title: 'Poranna trasa',
    description: 'Przejedź 10 km przed południem',
    xpReward: 120,
    check: (s) => ({ current: new Date().getHours() < 12 ? s.todayKm : 0, target: 10 }),
  },
  {
    emoji: '🗺️',
    title: 'Odkrywca',
    description: 'Przejedź 50 km dzisiaj',
    xpReward: 300,
    check: (s) => ({ current: s.todayKm, target: 50 }),
  },
  {
    emoji: '🚗',
    title: 'Aktywny dzień',
    description: 'Przejedź 3 trasy',
    xpReward: 130,
    check: (s) => ({ current: s.todayTripCount, target: 3 }),
  },
];

function getDailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export default function DailyChallenge({ stats }: DailyChallengeProps) {
  const challenge = useMemo(() => {
    const seed = getDailySeed();
    const idx = seed % CHALLENGES.length;
    return CHALLENGES[idx];
  }, []);

  const { current, target } = challenge.check(stats);
  const progress = Math.min(current / target, 1);
  const done = progress >= 1;

  return (
    <div className={`overflow-hidden rounded-2xl border ${done ? 'border-emerald-500/40 bg-emerald-500/8' : 'border-card-border bg-card-bg'}`}>
      <div className={`h-0.5 w-full ${done ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-accent to-orange-600'}`} />
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{challenge.emoji}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-foreground">{challenge.title}</p>
                {done && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500"
                  >
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </motion.span>
                )}
              </div>
              <p className="text-[11px] text-muted">{challenge.description}</p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1 rounded-full bg-accent/10 px-2 py-1">
            <svg className="h-3 w-3 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            <span className="text-[11px] font-bold text-accent">+{challenge.xpReward}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-input-bg">
            <motion.div
              className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-accent'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[11px] font-semibold text-muted tabular-nums whitespace-nowrap">
            {typeof current === 'number' && current % 1 !== 0 ? current.toFixed(1) : Math.floor(current)}/{target}
          </span>
        </div>
      </div>
    </div>
  );
}
