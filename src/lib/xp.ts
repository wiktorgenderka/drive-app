import { prisma } from './prisma';
import type { XPEventType } from '@prisma/client';
import { getLevelInfo } from './xp-shared';
export { LEVELS, getLevelInfo } from './xp-shared';

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
  ACHIEVEMENT_UNLOCKED: 0,
};

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
