'use client';

import { motion } from 'framer-motion';

interface StreakWidgetProps {
  currentStreak: number;
  longestStreak: number;
  isActiveToday?: boolean;
  compact?: boolean;
}

export default function StreakWidget({ currentStreak, longestStreak, isActiveToday = true, compact = false }: StreakWidgetProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`text-base ${currentStreak > 0 ? 'animate-flicker' : ''}`}>🔥</span>
        <span className="text-sm font-bold text-foreground tabular-nums">{currentStreak}</span>
        {isActiveToday && <span className="text-[10px] text-emerald-400 font-medium">dziś ✓</span>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/15">
            <span className={`text-2xl ${currentStreak >= 3 ? 'animate-flicker' : ''}`}>🔥</span>
            {isActiveToday && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">✓</span>
            )}
          </div>
          <div>
            <p className="text-xs text-muted">Aktualny streak</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{currentStreak} <span className="text-sm font-normal text-muted">dni</span></p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Rekord</p>
          <p className="text-lg font-bold text-foreground tabular-nums">{longestStreak} <span className="text-sm font-normal text-muted">dni</span></p>
        </div>
      </div>

      {/* Milestones */}
      {currentStreak > 0 && (
        <div className="mt-3 flex items-center gap-1">
          {[3, 7, 14, 30, 60, 100].map((milestone) => (
            <div
              key={milestone}
              className={`flex-1 text-center rounded py-1 text-[10px] font-semibold ${
                currentStreak >= milestone
                  ? 'bg-orange-500/20 text-orange-400'
                  : 'bg-input-bg text-muted'
              }`}
            >
              {milestone}d
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
