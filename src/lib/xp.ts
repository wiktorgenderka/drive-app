import { prisma } from './prisma';
import type { XPEventType } from '@prisma/client';

export const XP_VALUES: Record<XPEventType, number> = {
  TRIP_COMPLETED:      50,
  ROUTE_CREATED:      100,
  ROUTE_DRIVEN:        50,
  REPORT_CONFIRMED:    25,
  SPOT_CREATED:        30,
  CONVOY_JOINED:       20,
  FRIEND_ADDED:        15,
  POST_LIKED:          10,
  STREAK_BONUS:       200,
  ACHIEVEMENT_UNLOCKED: 0, // XP comes from achievement itself
};

export const LEVELS = [
  { level: 1,  name: 'Debiutant',       minXP: 0 },
  { level: 2,  name: 'Kierowca',        minXP: 500 },
  { level: 3,  name: 'Entuzjasta',      minXP: 1_500 },
  { level: 4,  name: 'Weteran Dróg',    minXP: 3_500 },
  { level: 5,  name: 'Asfalciarz',      minXP: 7_000 },
  { level: 6,  name: 'Drift King',      minXP: 13_000 },
  { level: 7,  name: 'Kanionowy Lis',   minXP: 22_000 },
  { level: 8,  name: 'Legenda Szos',    minXP: 35_000 },
  { level: 9,  name: 'Mistrzowska Klasa', minXP: 55_000 },
  { level: 10, name: 'Road God',        minXP: 100_000 },
] as const;

export function getLevelInfo(totalXP: number) {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  let next: (typeof LEVELS)[number] | null = LEVELS[1];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVELS[i].minXP) {
      current = LEVELS[i];
      next = i < LEVELS.length - 1 ? LEVELS[i + 1] : null;
      break;
    }
  }

  const xpInLevel = totalXP - current.minXP;
  const xpNeeded = next ? next.minXP - current.minXP : 1;
  const progress = next ? Math.min((xpInLevel / xpNeeded) * 100, 100) : 100;

  return { current, next, xpInLevel, xpNeeded, progress };
}

export async function awardXP(
  userId: string,
  type: XPEventType,
  meta?: Record<string, unknown>,
  overrideAmount?: number,
) {
  const amount = overrideAmount ?? XP_VALUES[type];
  if (amount <= 0) return null;

  const [xpEvent, upserted] = await prisma.$transaction([
    prisma.xPEvent.create({ data: { userId, type, amount, ...(meta ? { meta: meta as object } : {}) } }),
    prisma.userXP.upsert({
      where: { userId },
      update: { total: { increment: amount } },
      create: { userId, total: amount, level: 1 },
    }),
  ]);

  // Recalculate level
  const newTotal = upserted.total;
  const { current } = getLevelInfo(newTotal);
  if (current.level !== upserted.level) {
    await prisma.userXP.update({
      where: { userId },
      data: { level: current.level },
    });
  }

  return { xpEvent, newTotal, level: current.level };
}

export async function touchStreak(userId: string): Promise<{ isNewDay: boolean; streak: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.userStreak.findUnique({ where: { userId } });

  if (!existing) {
    await prisma.userStreak.create({
      data: { userId, currentStreak: 1, longestStreak: 1, lastActiveDate: today },
    });
    return { isNewDay: true, streak: 1 };
  }

  const lastDate = existing.lastActiveDate ? new Date(existing.lastActiveDate) : null;
  if (lastDate) lastDate.setHours(0, 0, 0, 0);

  const todayTime = today.getTime();
  const lastTime = lastDate?.getTime() ?? 0;

  // Already counted today
  if (lastTime === todayTime) return { isNewDay: false, streak: existing.currentStreak };

  const yesterday = todayTime - 86_400_000;
  const isConsecutive = lastTime === yesterday;

  const newStreak = isConsecutive ? existing.currentStreak + 1 : 1;
  const longestStreak = Math.max(newStreak, existing.longestStreak);

  await prisma.userStreak.update({
    where: { userId },
    data: { currentStreak: newStreak, longestStreak, lastActiveDate: today },
  });

  // Bonus XP for 7-day streak
  if (newStreak % 7 === 0) {
    await awardXP(userId, 'STREAK_BONUS');
  }

  return { isNewDay: true, streak: newStreak };
}
