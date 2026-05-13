import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { awardXP } from '@/lib/xp';

export const dynamic = 'force-dynamic';

interface Challenge {
  key: string;
  title: string;
  xpReward: number;
  verify: (stats: DayStats) => boolean;
}

interface DayStats {
  todayKm: number;
  todayTripCount: number;
  todayReports: number;
  streakCurrent: number;
}

const CHALLENGES: Challenge[] = [
  { key: 'km20',     title: 'Dzienna trasówka',  xpReward: 150, verify: (s) => s.todayKm >= 20 },
  { key: 'report2',  title: 'Strażnik dróg',     xpReward: 80,  verify: (s) => s.todayReports >= 2 },
  { key: 'trip2',    title: 'Podróżnik',          xpReward: 100, verify: (s) => s.todayTripCount >= 2 },
  { key: 'streak3',  title: 'Utrzymaj streak',    xpReward: 200, verify: (s) => s.streakCurrent >= 3 },
  { key: 'morning',  title: 'Poranna trasa',      xpReward: 120, verify: (s) => new Date().getHours() < 12 && s.todayKm >= 10 },
  { key: 'km50',     title: 'Odkrywca',           xpReward: 300, verify: (s) => s.todayKm >= 50 },
  { key: 'trip3',    title: 'Aktywny dzień',      xpReward: 130, verify: (s) => s.todayTripCount >= 3 },
];

function getDailyChallengeKey(): string {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return CHALLENGES[seed % CHALLENGES.length].key;
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const todayStr = getTodayString();
  const challengeKey = getDailyChallengeKey();
  const challenge = CHALLENGES.find((c) => c.key === challengeKey)!;

  // Check already claimed today
  const alreadyClaimed = await prisma.xPEvent.findFirst({
    where: {
      userId,
      type: 'STREAK_BONUS',
      meta: { path: ['dailyChallengeDate'], equals: todayStr },
    },
  });
  if (alreadyClaimed) {
    return NextResponse.json({ error: 'already_claimed' }, { status: 409 });
  }

  // Build today's stats server-side
  const todayStart = new Date(todayStr + 'T00:00:00.000Z');
  const tomorrow = new Date(todayStart.getTime() + 86_400_000);

  const [tripAgg, reportCount, streak] = await Promise.all([
    prisma.trip.aggregate({
      where: { userId, startedAt: { gte: todayStart, lt: tomorrow } },
      _sum: { distanceKm: true },
      _count: { id: true },
    }),
    prisma.xPEvent.count({
      where: { userId, type: 'REPORT_CONFIRMED', createdAt: { gte: todayStart, lt: tomorrow } },
    }),
    prisma.userStreak.findUnique({ where: { userId } }),
  ]);

  const stats: DayStats = {
    todayKm: tripAgg._sum.distanceKm ?? 0,
    todayTripCount: tripAgg._count.id,
    todayReports: reportCount,
    streakCurrent: streak?.currentStreak ?? 0,
  };

  if (!challenge.verify(stats)) {
    return NextResponse.json({ error: 'not_complete', stats }, { status: 422 });
  }

  // Award XP using STREAK_BONUS type with daily challenge meta
  await awardXP(userId, 'STREAK_BONUS', {
    dailyChallengeDate: todayStr,
    challengeKey,
    challengeTitle: challenge.title,
  }, challenge.xpReward);

  return NextResponse.json({ ok: true, xpAwarded: challenge.xpReward, title: challenge.title });
}
