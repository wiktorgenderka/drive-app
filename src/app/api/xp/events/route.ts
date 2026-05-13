import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const EVENT_LABELS: Record<string, string> = {
  TRIP_COMPLETED:     'Podróż ukończona',
  ROUTE_CREATED:      'Trasa stworzona',
  ROUTE_DRIVEN:       'Trasa przejechana',
  REPORT_CONFIRMED:   'Raport potwierdzony',
  SPOT_CREATED:       'Spot dodany',
  CONVOY_JOINED:      'Dołączenie do konwoju',
  FRIEND_ADDED:       'Nowy znajomy',
  POST_LIKED:         'Post polubiony',
  STREAK_BONUS:       'Bonus streaka',
  ACHIEVEMENT_UNLOCKED: 'Odznaka odblokowana',
};

const EVENT_EMOJI: Record<string, string> = {
  TRIP_COMPLETED:     '🚗',
  ROUTE_CREATED:      '🗺️',
  ROUTE_DRIVEN:       '🏁',
  REPORT_CONFIRMED:   '🚨',
  SPOT_CREATED:       '📍',
  CONVOY_JOINED:      '👥',
  FRIEND_ADDED:       '🤝',
  POST_LIKED:         '❤️',
  STREAK_BONUS:       '🔥',
  ACHIEVEMENT_UNLOCKED: '🏅',
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10) || 20);

  const events = await prisma.xPEvent.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, type: true, amount: true, createdAt: true, meta: true },
  });

  return NextResponse.json(events.map((e) => {
    const meta = e.meta as Record<string, unknown> | null;
    const isChallenge = meta?.dailyChallengeDate != null;
    return {
      id: e.id,
      type: e.type,
      label: isChallenge ? `Wyzwanie dnia: ${meta!.challengeTitle ?? 'Dzienne wyzwanie'}` : (EVENT_LABELS[e.type] ?? e.type),
      emoji: isChallenge ? '🎯' : (EVENT_EMOJI[e.type] ?? '⚡'),
      amount: e.amount,
      createdAt: e.createdAt,
      meta: e.meta,
    };
  }));
}
