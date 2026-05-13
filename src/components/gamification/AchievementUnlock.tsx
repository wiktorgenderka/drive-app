'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AchievementUnlockProps {
  achievement: {
    key: string;
    name: string;
    description: string;
    emoji: string;
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    xpReward: number;
  } | null;
  onDismiss: () => void;
}

const RARITY_CONFIG = {
  COMMON:    { label: 'Pospolite',   gradient: 'from-zinc-600 to-zinc-400',    glow: 'rgba(161,161,170,0.4)' },
  RARE:      { label: 'Rzadkie',     gradient: 'from-blue-600 to-blue-400',    glow: 'rgba(59,130,246,0.5)' },
  EPIC:      { label: 'Epickie',     gradient: 'from-purple-600 to-fuchsia-400', glow: 'rgba(168,85,247,0.5)' },
  LEGENDARY: { label: 'Legendarne', gradient: 'from-yellow-500 to-amber-300', glow: 'rgba(245,158,11,0.6)' },
};

export default function AchievementUnlock({ achievement, onDismiss }: AchievementUnlockProps) {
  useEffect(() => {
    if (!achievement) return;
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [achievement, onDismiss]);

  const cfg = achievement ? RARITY_CONFIG[achievement.rarity] : null;

  return (
    <AnimatePresence>
      {achievement && cfg && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          onClick={onDismiss}
        >
          {/* Blurred background */}
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

          {/* Confetti rays */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className={`absolute left-1/2 top-1/2 h-1 w-32 origin-left bg-gradient-to-r ${cfg.gradient} opacity-30 rounded-full`}
                style={{ rotate: i * 30 }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: [0, 1.5, 0], opacity: [0, 0.4, 0] }}
                transition={{ duration: 1.2, delay: 0.3 + i * 0.04, ease: 'easeOut' }}
              />
            ))}
          </div>

          {/* Card */}
          <motion.div
            initial={{ scale: 0.5, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.05 }}
            className="relative z-10 flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-card-bg p-8 shadow-2xl text-center max-w-xs w-full mx-4"
            style={{ boxShadow: `0 0 60px ${cfg.glow}, 0 20px 60px rgba(0,0,0,0.5)` }}
          >
            {/* Rarity badge */}
            <div className={`rounded-full bg-gradient-to-r ${cfg.gradient} px-3 py-1`}>
              <span className="text-xs font-bold text-white uppercase tracking-wide">{cfg.label}</span>
            </div>

            {/* Emoji */}
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
              className={`flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${cfg.gradient} text-4xl shadow-xl`}
              style={{ boxShadow: `0 0 30px ${cfg.glow}` }}
            >
              {achievement.emoji}
            </motion.div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted uppercase tracking-widest">Odznaka odblokowana!</p>
              <h3 className="text-xl font-bold text-foreground">{achievement.name}</h3>
              <p className="text-sm text-muted">{achievement.description}</p>
            </div>

            {achievement.xpReward > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-1.5 rounded-full bg-accent/15 px-4 py-1.5"
              >
                <span className="text-sm font-bold text-accent">+{achievement.xpReward} XP</span>
              </motion.div>
            )}

            <p className="text-[11px] text-muted-light">Kliknij aby zamknąć</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
