'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Avatar from '@/components/ui/Avatar';
import { LevelBadge } from './XPBar';
import { getLevelInfo } from '@/lib/xp';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  value: number;
  levelName?: string;
  level?: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  myRank: number | null;
  myValue: number;
}

const CATEGORIES = [
  { key: 'xp',      label: 'XP',      emoji: '⭐' },
  { key: 'km',      label: 'Km/tydz', emoji: '🛣️' },
  { key: 'reports', label: 'Raporty', emoji: '🚔' },
] as const;

const RANK_STYLE: Record<number, string> = {
  1: 'text-yellow-400 font-black',
  2: 'text-zinc-400 font-bold',
  3: 'text-amber-600 font-bold',
};
const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Leaderboard({ currentUserId }: { currentUserId: string }) {
  const [category, setCategory] = useState<'xp' | 'km' | 'reports'>('xp');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leaderboard?category=${category}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-card-border">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key as 'xp' | 'reports')}
            className={`relative flex-1 py-3 text-sm font-medium transition-colors ${
              category === cat.key ? 'text-foreground' : 'text-muted hover:text-foreground'
            }`}
          >
            {cat.emoji} {cat.label}
            {category === cat.key && (
              <motion.div layoutId="lb-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
            )}
          </button>
        ))}
      </div>

      <div className="divide-y divide-card-border">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
              <div className="h-8 w-6 rounded bg-input-bg" />
              <div className="h-8 w-8 rounded-full bg-input-bg" />
              <div className="flex-1 h-4 rounded bg-input-bg" />
              <div className="h-4 w-16 rounded bg-input-bg" />
            </div>
          ))
        ) : (
          data?.entries.map((entry, i) => {
            const isMe = entry.userId === currentUserId;
            const levelInfo = entry.level ? getLevelInfo(entry.value) : null;

            return (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-accent/8' : ''}`}
              >
                {/* Rank */}
                <div className="w-7 text-center">
                  {RANK_MEDAL[entry.rank] ? (
                    <span className="text-lg">{RANK_MEDAL[entry.rank]}</span>
                  ) : (
                    <span className={`text-sm ${RANK_STYLE[entry.rank] ?? 'text-muted'}`}>
                      {entry.rank}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <Avatar name={entry.name} image={entry.image} size="sm" />

                {/* Name + level */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isMe ? 'text-accent' : 'text-foreground'}`}>
                    {entry.name} {isMe && <span className="text-[10px]">(Ty)</span>}
                  </p>
                  {entry.levelName && (
                    <p className="text-[10px] text-muted">{entry.levelName}</p>
                  )}
                </div>

                {/* Level badge + value */}
                <div className="flex items-center gap-2 shrink-0">
                  {entry.level && <LevelBadge level={entry.level} size="sm" />}
                  <span className="text-sm font-bold text-foreground tabular-nums">
                    {category === 'xp'
                      ? entry.value.toLocaleString('pl-PL')
                      : category === 'km'
                      ? `${entry.value} km`
                      : entry.value}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* My rank footer */}
      {data?.myRank && data.myRank > 10 && (
        <div className="border-t border-card-border bg-accent/8 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-muted">Twoja pozycja</span>
          <span className="text-sm font-bold text-accent">#{data.myRank}</span>
        </div>
      )}
    </div>
  );
}
