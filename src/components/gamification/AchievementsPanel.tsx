'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Achievement {
  key: string;
  name: string;
  description: string;
  emoji: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  xpReward: number;
  unlocked: boolean;
}

const RARITY_ORDER: Achievement['rarity'][] = ['LEGENDARY', 'EPIC', 'RARE', 'COMMON'];

const RARITY_CONFIG: Record<Achievement['rarity'], {
  label: string; gradient: string; border: string; badge: string;
}> = {
  COMMON:    { label: 'Pospolite',   gradient: 'from-zinc-600 to-zinc-500',      border: 'border-zinc-500/30',   badge: 'bg-zinc-500/20 text-zinc-300' },
  RARE:      { label: 'Rzadkie',     gradient: 'from-blue-600 to-blue-500',      border: 'border-accent/30',   badge: 'bg-blue-500/20 text-blue-300' },
  EPIC:      { label: 'Epickie',     gradient: 'from-purple-600 to-fuchsia-500', border: 'border-purple-500/30', badge: 'bg-purple-500/20 text-purple-300' },
  LEGENDARY: { label: 'Legendarne', gradient: 'from-yellow-500 to-amber-400',   border: 'border-yellow-500/40', badge: 'bg-yellow-500/20 text-yellow-300' },
};

type Filter = 'all' | Achievement['rarity'] | 'unlocked' | 'locked';

export default function AchievementsPanel() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [sharingKey, setSharingKey] = useState<string | null>(null);
  const [sharedKey, setSharedKey] = useState<string | null>(null);

  const shareAchievement = useCallback(async (ach: Achievement) => {
    const text = `ZdobyĹ‚em odznakÄ™ ${ach.emoji} "${ach.name}" w DriveApp! ${ach.description} (+${ach.xpReward} XP)`;
    setSharingKey(ach.key);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `Odznaka: ${ach.name}`, text });
      } else {
        const res = await fetch('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text }),
        });
        if (!res.ok) throw new Error('Post failed');
      }
      setSharedKey(ach.key);
      setTimeout(() => setSharedKey(null), 3000);
    } catch { /* user cancelled or network error */ }
    setSharingKey(null);
  }, []);

  useEffect(() => {
    fetch('/api/achievements')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setAchievements(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    );
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;
  const progress = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  const filtered = achievements.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'unlocked') return a.unlocked;
    if (filter === 'locked') return !a.unlocked;
    return a.rarity === filter;
  });

  // Sort: unlocked first, then by rarity order
  const sorted = [...filtered].sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
  });

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Wszystkie' },
    { id: 'unlocked', label: `Odblokowane (${unlockedCount})` },
    { id: 'locked', label: 'Zablokowane' },
    { id: 'LEGENDARY', label: 'â­ Legendarne' },
    { id: 'EPIC', label: 'đźźŁ Epickie' },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Progress summary */}
      <div className="rounded-2xl border border-card-border bg-card-bg p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">PostÄ™p odznak</p>
          <span className="text-sm font-bold text-accent">{unlockedCount}/{totalCount}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-input-bg">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent to-orange-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted">{progress}% kolekcji odblokowane</p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filter === f.id
                ? 'bg-accent text-accent-fg'
                : 'border border-card-border bg-card-bg text-muted hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-2 gap-3">
        {sorted.map((ach, i) => {
          const cfg = RARITY_CONFIG[ach.rarity];
          return (
            <motion.div
              key={ach.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`relative flex flex-col gap-2 overflow-hidden rounded-2xl border p-3 ${
                ach.unlocked ? cfg.border : 'border-card-border'
              } ${ach.unlocked ? 'bg-card-bg' : 'bg-card-bg/40'}`}
            >
              {/* Gradient top accent for unlocked */}
              {ach.unlocked && (
                <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${cfg.gradient}`} />
              )}

              <div className="flex items-start justify-between gap-1">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl ${
                  ach.unlocked
                    ? `bg-gradient-to-br ${cfg.gradient} shadow-lg`
                    : 'bg-input-bg'
                } ${!ach.unlocked ? 'grayscale opacity-30' : ''}`}>
                  {ach.emoji}
                </div>
                {ach.unlocked ? (
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                ) : (
                  <svg className="h-4 w-4 shrink-0 text-muted opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                )}
              </div>

              <div className="min-w-0">
                <p className={`text-xs font-bold leading-tight ${ach.unlocked ? 'text-foreground' : 'text-muted'}`}>
                  {ach.name}
                </p>
                <p className={`mt-0.5 text-[11px] leading-tight ${ach.unlocked ? 'text-muted' : 'text-muted/50'}`}>
                  {ach.description}
                </p>
              </div>

              <div className="flex items-center justify-between gap-1">
                {ach.xpReward > 0 && (
                  <div className={`flex items-center gap-1 ${ach.unlocked ? 'text-accent' : 'text-muted/30'}`}>
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span className="text-[10px] font-bold">+{ach.xpReward} XP</span>
                  </div>
                )}
                {ach.unlocked && (
                  <button
                    onClick={() => shareAchievement(ach)}
                    disabled={sharingKey === ach.key}
                    className="ml-auto shrink-0 rounded-lg p-1 text-muted transition hover:text-foreground disabled:opacity-50"
                    title="UdostÄ™pnij odznakÄ™"
                  >
                    <AnimatePresence mode="wait">
                      {sharedKey === ach.key ? (
                        <motion.svg key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                          className="h-3.5 w-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path d="M20 6L9 17l-5-5" />
                        </motion.svg>
                      ) : sharingKey === ach.key ? (
                        <motion.div key="spin" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted/30 border-t-muted" />
                      ) : (
                        <motion.svg key="share" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                          className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                          <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
                        </motion.svg>
                      )}
                    </AnimatePresence>
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-4xl">đź”’</span>
          <p className="text-sm font-semibold text-foreground">Brak odznak w tej kategorii</p>
        </div>
      )}
    </div>
  );
}
