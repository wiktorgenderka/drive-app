import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { ACHIEVEMENTS } from '@/lib/achievements';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userAchievements = await prisma.userAchievement.findMany({
    where: { userId: session.user.id },
    include: { achievement: { select: { key: true } } },
  });

  const unlockedKeys = new Set(userAchievements.map((ua) => ua.achievement.key));

  const all = ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: unlockedKeys.has(a.key),
  }));

  return NextResponse.json(all);
}
