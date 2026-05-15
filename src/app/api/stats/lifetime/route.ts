import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  try {
    const [
      tripAgg,
      tripCount,
      longestTrip,
      fastestTrip,
      reportCount,
      routeCount,
      friendCount,
      convoyCount,
      spotCount,
      postCount,
      xpTotal,
      memberSince,
    ] = await Promise.all([
      prisma.trip.aggregate({
        where: { userId },
        _sum: { distanceKm: true, durationMin: true },
        _avg: { avgSpeedKmh: true },
        _max: { maxSpeedKmh: true },
      }),
      prisma.trip.count({ where: { userId } }),
      prisma.trip.findFirst({
        where: { userId, distanceKm: { gt: 0 } },
        orderBy: { distanceKm: 'desc' },
        select: { distanceKm: true },
      }),
      prisma.trip.findFirst({
        where: { userId, maxSpeedKmh: { gt: 0 } },
        orderBy: { maxSpeedKmh: 'desc' },
        select: { maxSpeedKmh: true },
      }),
      prisma.report.count({ where: { userId } }),
      prisma.route.count({ where: { userId } }),
      prisma.friendship.count({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }], status: 'ACCEPTED' },
      }),
      prisma.convoyMember.count({ where: { userId } }),
      prisma.spot.count({ where: { createdById: userId } }),
      prisma.post.count({ where: { userId } }),
      prisma.userXP.findUnique({ where: { userId }, select: { total: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    ]);

    return NextResponse.json({
      totalKm: Number(tripAgg._sum.distanceKm ?? 0),
      totalMinutes: Number(tripAgg._sum.durationMin ?? 0),
      totalTrips: tripCount,
      avgSpeedKmh: Math.round(Number(tripAgg._avg.avgSpeedKmh ?? 0)),
      maxSpeedKmh: Math.round(Number(tripAgg._max.maxSpeedKmh ?? 0)),
      longestTripKm: Number(longestTrip?.distanceKm ?? 0),
      fastestTripSpeed: Math.round(Number(fastestTrip?.maxSpeedKmh ?? 0)),
      totalReports: reportCount,
      totalRoutes: routeCount,
      totalFriends: friendCount,
      totalConvoys: convoyCount,
      totalSpots: spotCount,
      totalPosts: postCount,
      totalXP: xpTotal?.total ?? 0,
      memberSince: memberSince?.createdAt ?? null,
    });
  } catch (err) {
    console.error('[stats/lifetime]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
