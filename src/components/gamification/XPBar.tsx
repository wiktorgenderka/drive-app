'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface XPBarProps {
  total: number;
  level: number;
  levelName: string;
  progress: number; // 0–100
  xpInLevel: number;
  xpNeeded: number;
  nextLevel: { level: number; name: string } | null;
  compact?: boolean;
}

const LEVEL_COLORS: Record<number, string> = {
  1:  'from-zinc-500 to-zinc-400',
  2:  'from-green-600 to-green-400',
  3:  'from-teal-600 to-teal-400',
  4:  'from-blue-600 to-blue-400',
  5:  'from-violet-600 to-violet-400',
  6:  'from-purple-600 to-fuchsia-400',
  7:  'from-orange-600 to-amber-400',
  8:  'from-red-600 to-orange-400',
  9:  'from-rose-600 to-pink-400',
  10: 'from-yellow-500 to-amber-300',
};

export default function XPBar({
  total, level, levelName, progress, xpInLevel, xpNeeded, nextLevel, compact = false,
}: XPBarProps) {
  const gradient = LEVEL_COLORS[level] ?? LEVEL_COLORS[1];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <LevelBadge level={level} gradient={gradient} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[11px] font-semibold text-foreground truncate">{levelName}</span>
            <span className="text-[10px] text-muted tabular-nums">{xpInLevel}/{xpNeeded} XP</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-input-bg">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <div className="flex items-center gap-3 mb-3">
        <LevelBadge level={level} gradient={gradient} size="lg" />
        <div>
          <p className="text-sm font-bold text-foreground">{levelName}</p>
          <p className="text-xs text-muted tabular-nums">{total.toLocaleString('pl-PL')} XP łącznie</p>
        </div>
        {nextLevel && (
          <div className="ml-auto text-right">
            <p className="text-[10px] text-muted">Następny poziom</p>
            <p className="text-xs font-semibold text-foreground">{nextLevel.name}</p>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted">Postęp do {nextLevel?.name ?? 'MAX'}</span>
          <span className="tabular-nums font-medium text-foreground">
            {xpInLevel.toLocaleString('pl-PL')} / {xpNeeded.toLocaleString('pl-PL')} XP
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-input-bg">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.2 }}
          />
          {/* Shimmer */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{ duration: 1.8, ease: 'easeInOut', delay: 1.2 }}
          />
        </div>
      </div>
    </div>
  );
}

interface LevelBadgeProps {
  level: number;
  gradient?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LevelBadge({ level, gradient, size = 'md' }: LevelBadgeProps) {
  const g = gradient ?? LEVEL_COLORS[level] ?? LEVEL_COLORS[1];
  const sizes = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base' };
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${g} font-bold text-white shadow-md ${sizes[size]}`}>
      {level}
    </div>
  );
}

export { LEVEL_COLORS };
