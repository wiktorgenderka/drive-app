import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLevelInfo } from '@/lib/xp';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [xp, streak, achievements] = await Promise.all([
    prisma.userXP.findUnique({ where: { userId: session.user.id } }),
    prisma.userStreak.findUnique({ where: { userId: session.user.id } }),
    prisma.userAchievement.findMany({
      where: { userId: session.user.id },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
    }),
  ]);

  const total = xp?.total ?? 0;
  const levelInfo = getLevelInfo(total);

  return NextResponse.json({
    total,
    level: levelInfo.current.level,
    levelName: levelInfo.current.name,
    nextLevel: levelInfo.next,
    progress: levelInfo.progress,
    xpInLevel: levelInfo.xpInLevel,
    xpNeeded: levelInfo.xpNeeded,
    streak: {
      current: streak?.currentStreak ?? 0,
      longest: streak?.longestStreak ?? 0,
      lastActive: streak?.lastActiveDate ?? null,
    },
    achievements: achievements.map((ua) => ({
      key: ua.achievement.key,
      name: ua.achievement.name,
      description: ua.achievement.description,
      emoji: ua.achievement.emoji,
      rarity: ua.achievement.rarity,
      xpReward: ua.achievement.xpReward,
      unlockedAt: ua.unlockedAt,
    })),
  });
}
