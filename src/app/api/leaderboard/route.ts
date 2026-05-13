import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLevelInfo } from '@/lib/xp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') ?? 'xp';

  if (category === 'xp') {
    const rows = await prisma.userXP.findMany({
      take: 10,
      orderBy: { total: 'desc' },
      include: { user: { select: { id: true, name: true, image: true } } },
    });

    const myXP = await prisma.userXP.findUnique({ where: { userId: session.user.id } });
    const myRank = myXP
      ? await prisma.userXP.count({ where: { total: { gt: myXP.total } } })
      : null;

    return NextResponse.json({
      category,
      entries: rows.map((r, i) => ({
        rank: i + 1,
        userId: r.user.id,
        name: r.user.name,
        image: r.user.image,
        value: r.total,
        levelName: getLevelInfo(r.total).current.name,
        level: getLevelInfo(r.total).current.level,
      })),
      myRank: myRank !== null ? myRank + 1 : null,
      myValue: myXP?.total ?? 0,
    });
  }

  if (category === 'reports') {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const rows = await prisma.xPEvent.groupBy({
      by: ['userId'],
      where: { type: 'REPORT_CONFIRMED', createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });

    const users = await prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, name: true, image: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    return NextResponse.json({
      category,
      entries: rows.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        name: userMap[r.userId]?.name ?? '?',
        image: userMap[r.userId]?.image ?? null,
        value: r._sum.amount ?? 0,
      })),
      myRank: null,
      myValue: 0,
    });
  }

  return NextResponse.json({ error: 'Unknown category' }, { status: 400 });
}
