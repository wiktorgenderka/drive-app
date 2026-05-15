import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/users/me/export — GDPR data export
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  try {
    const [user, trips, routes, reports, posts, friends, achievements] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, image: true, bio: true, carDisplay: true, createdAt: true, updatedAt: true },
      }),
      prisma.trip.findMany({
        where: { userId },
        select: { id: true, startedAt: true, endedAt: true, distanceKm: true, maxSpeedKmh: true, durationMin: true, vehicleId: true },
      }),
      prisma.route.findMany({
        where: { userId },
        select: { id: true, name: true, description: true, isPublic: true, createdAt: true, waypoints: true },
      }),
      prisma.report.findMany({
        where: { userId },
        select: { id: true, type: true, latitude: true, longitude: true, description: true, createdAt: true, expiresAt: true },
      }),
      prisma.post.findMany({
        where: { userId },
        select: { id: true, content: true, createdAt: true, _count: { select: { likes: true, comments: true } } },
      }),
      prisma.friendship.findMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
        select: { id: true, status: true, createdAt: true, requesterId: true, addresseeId: true },
      }),
      prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: { select: { key: true, name: true, emoji: true, rarity: true } } },
        orderBy: { unlockedAt: 'asc' },
      }),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      user,
      trips,
      routes: routes.map((r) => ({ ...r, waypoints: r.waypoints })),
      reports,
      posts,
      friendships: friends,
      achievements: achievements.map((a) => ({
        ...a.achievement,
        unlockedAt: a.unlockedAt,
      })),
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="driveapp-export-${userId}-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/users/me/export error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
