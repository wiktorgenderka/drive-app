'use client';

import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
    emoji: 'đź›Łď¸Ź',
    title: 'Dzienna trasĂłwka',
    description: 'PrzejedĹş 20 km dzisiaj',
    xpReward: 150,
    check: (s) => ({ current: s.todayKm, target: 20 }),
  },
  {
    emoji: 'đźš¨',
    title: 'StraĹĽnik drĂłg',
    description: 'Dodaj 2 raporty drogowe',
    xpReward: 80,
    check: (s) => ({ current: s.todayReports, target: 2 }),
  },
  {
    emoji: 'đźŹ',
    title: 'PodrĂłĹĽnik',
    description: 'UkoĹ„cz 2 podrĂłĹĽe',
    xpReward: 100,
    check: (s) => ({ current: s.todayTripCount, target: 2 }),
  },
  {
    emoji: 'đź”Ą',
    title: 'Utrzymaj streak',
    description: 'BÄ…dĹş aktywny przez 3 dni z rzÄ™du',
    xpReward: 200,
    check: (s) => ({ current: s.streakCurrent, target: 3 }),
  },
  {
    emoji: 'đźŚ„',
    title: 'Poranna trasa',
    description: 'PrzejedĹş 10 km przed poĹ‚udniem',
    xpReward: 120,
    check: (s) => ({ current: new Date().getHours() < 12 ? s.todayKm : 0, target: 10 }),
  },
  {
    emoji: 'đź—şď¸Ź',
    title: 'Odkrywca',
    description: 'PrzejedĹş 50 km dzisiaj',
    xpReward: 300,
    check: (s) => ({ current: s.todayKm, target: 50 }),
  },
  {
    emoji: 'đźš—',
    title: 'Aktywny dzieĹ„',
    description: 'PrzejedĹş 3 trasy',
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

  const todayStr = new Date().toISOString().slice(0, 10);
  const claimKey = `driveapp_daily_claimed_${todayStr}`;
  const [claimed, setClaimed] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    setClaimed(localStorage.getItem(claimKey) === '1');
  }, [claimKey]);

  async function handleClaim() {
    setClaiming(true);
    try {
      const res = await fetch('/api/daily-challenge/claim', { method: 'POST' });
      if (res.ok || (await res.json()).error === 'already_claimed') {
        localStorage.setItem(claimKey, '1');
        setClaimed(true);
      }
    } catch { /* silent */ }
    setClaiming(false);
  }

  return (
    <div className={`overflow-hidden rounded-2xl border ${claimed ? 'border-emerald-500/40 bg-emerald-500/8' : done ? 'border-accent/40 bg-accent/5' : 'border-card-border bg-card-bg'}`}>
      <div className={`h-0.5 w-full ${claimed ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : done ? 'bg-gradient-to-r from-accent to-orange-600' : 'bg-gradient-to-r from-accent/30 to-orange-600/30'}`} />
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{challenge.emoji}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-foreground">{challenge.title}</p>
                {claimed && (
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
          <AnimatePresence mode="wait">
            {done && !claimed ? (
              <motion.button
                key="claim"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                whileTap={{ scale: 0.94 }}
                onClick={handleClaim}
                disabled={claiming}
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-accent-fg shadow transition hover:opacity-90 disabled:opacity-60"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                {claiming ? 'â€¦' : `Odbierz +${challenge.xpReward}`}
              </motion.button>
            ) : (
              <motion.div
                key="badge"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`shrink-0 flex items-center gap-1 rounded-full px-2 py-1 ${claimed ? 'bg-emerald-500/15' : 'bg-accent/10'}`}
              >
                <svg className={`h-3 w-3 ${claimed ? 'text-emerald-400' : 'text-accent'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span className={`text-[11px] font-bold ${claimed ? 'text-emerald-400' : 'text-accent'}`}>
                  {claimed ? 'Odebrano!' : `+${challenge.xpReward}`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-input-bg">
            <motion.div
              className={`h-full rounded-full ${claimed ? 'bg-emerald-500' : 'bg-accent'}`}
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