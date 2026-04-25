import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export type FriendshipState = 'self' | 'friend' | 'pending_out' | 'pending_in' | 'rejected' | 'none';

interface Achievement {
  id: string;
  label: string;
  hint: string;
  icon: 'trophy' | 'medal' | 'star' | 'flame' | 'route' | 'calendar' | 'thumbs' | 'speed';
  tier: 'bronze' | 'silver' | 'gold';
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: userId } = await context.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        image: true,
        carDisplay: true,
        bio: true,
        createdAt: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Najlepszy czas tego użytkownika dla każdej publicznej trasy.
    const grouped = await prisma.routeTime.groupBy({
      by: ["routeId"],
      where: { userId, route: { isPublic: true } },
      _min: { seconds: true },
      _count: { _all: true },
    });

    const routeIds = grouped.map((g) => g.routeId);
    const routeRows = routeIds.length > 0
      ? await prisma.route.findMany({
          where: { id: { in: routeIds } },
          select: { id: true, name: true },
        })
      : [];
    const routeMap = new Map(routeRows.map((r) => [r.id, r]));

    const records = await Promise.all(
      grouped.map(async (g) => {
        const userBest = g._min.seconds ?? 0;
        const better = await prisma.routeTime.groupBy({
          by: ["userId"],
          where: { routeId: g.routeId },
          _min: { seconds: true },
        });
        const position =
          better.filter((b) => (b._min.seconds ?? Infinity) < userBest).length + 1;
        return {
          routeId: g.routeId,
          routeName: routeMap.get(g.routeId)?.name ?? 'Trasa',
          bestSeconds: userBest,
          attempts: g._count._all,
          position,
        };
      })
    );
    records.sort((a, b) => a.position - b.position || a.bestSeconds - b.bestSeconds);

    // Trasy publiczne stworzone przez tego użytkownika.
    const publishedRoutes = await prisma.route.findMany({
      where: { userId, isPublic: true },
      orderBy: [
        { avgRating: { sort: 'desc', nulls: 'last' } },
        { ratingCount: 'desc' },
        { publishedAt: 'desc' },
      ],
      take: 5,
      select: {
        id: true,
        name: true,
        avgRating: true,
        ratingCount: true,
        publishedAt: true,
        _count: { select: { times: true, imports: true } },
      },
    });
    const publishedRoutesCount = await prisma.route.count({ where: { userId, isPublic: true } });

    // Średnia ocen wszystkich publicznych tras tego użytkownika (ważona liczbą ocen).
    const ratingAgg = await prisma.route.aggregate({
      where: { userId, isPublic: true, ratingCount: { gt: 0 } },
      _avg: { avgRating: true },
      _sum: { ratingCount: true },
    });

    // Statystyki podróży (Trip).
    const tripAgg = await prisma.trip.aggregate({
      where: { userId },
      _sum: { distanceKm: true, durationMin: true },
      _max: { maxSpeedKmh: true },
      _avg: { avgSpeedKmh: true },
      _count: { _all: true },
    });

    const tripStats = {
      tripCount: tripAgg._count._all,
      totalKm: tripAgg._sum.distanceKm ?? 0,
      totalMinutes: tripAgg._sum.durationMin ?? 0,
      maxSpeedKmh: tripAgg._max.maxSpeedKmh ?? 0,
      avgSpeedKmh: tripAgg._avg.avgSpeedKmh ?? 0,
    };

    const stats = {
      totalRoutes: records.length,
      totalAttempts: records.reduce((s, r) => s + r.attempts, 0),
      podiums: records.filter((r) => r.position <= 3).length,
      wins: records.filter((r) => r.position === 1).length,
      publishedRoutes: publishedRoutesCount,
      avgRouteRating: ratingAgg._avg.avgRating ?? null,
      totalRatingsReceived: ratingAgg._sum.ratingCount ?? 0,
    };

    // Status znajomości z aktualnym viewerem.
    let friendship: FriendshipState = 'none';
    let friendshipId: string | null = null;
    if (userId === session.user.id) {
      friendship = 'self';
    } else {
      const f = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: session.user.id, addresseeId: userId },
            { requesterId: userId, addresseeId: session.user.id },
          ],
        },
      });
      if (f) {
        friendshipId = f.id;
        if (f.status === 'ACCEPTED') friendship = 'friend';
        else if (f.status === 'REJECTED') friendship = 'rejected';
        else if (f.requesterId === session.user.id) friendship = 'pending_out';
        else friendship = 'pending_in';
      }
    }

    // Achievements (pochodne, bez zapisu w bazie).
    const accountDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86_400_000);
    const achievements: Achievement[] = [];
    const push = (a: Achievement) => achievements.push(a);

    if (stats.wins >= 10) push({ id: 'champion', label: 'Mistrz tras', hint: '10+ pierwszych miejsc', icon: 'trophy', tier: 'gold' });
    else if (stats.wins >= 3) push({ id: 'winner3', label: 'Zwycięzca', hint: '3+ pierwsze miejsca', icon: 'trophy', tier: 'silver' });
    else if (stats.wins >= 1) push({ id: 'first_win', label: 'Pierwsze złoto', hint: 'Pierwsze miejsce na trasie', icon: 'trophy', tier: 'bronze' });

    if (stats.podiums >= 5) push({ id: 'podium5', label: 'Stały bywalec podium', hint: '5+ miejsc 1–3', icon: 'medal', tier: 'silver' });

    if (stats.totalRoutes >= 10) push({ id: 'explorer10', label: 'Eksplorator', hint: '10+ ukończonych tras', icon: 'route', tier: 'silver' });
    else if (stats.totalRoutes >= 1) push({ id: 'first_run', label: 'Pierwszy przejazd', hint: 'Ukończona pierwsza trasa', icon: 'route', tier: 'bronze' });

    if (publishedRoutesCount >= 5) push({ id: 'creator5', label: 'Twórca tras', hint: '5+ publicznych tras', icon: 'star', tier: 'silver' });
    else if (publishedRoutesCount >= 1) push({ id: 'creator1', label: 'Pierwsza publikacja', hint: '1+ publiczna trasa', icon: 'star', tier: 'bronze' });

    if ((stats.avgRouteRating ?? 0) >= 4.5 && stats.totalRatingsReceived >= 5) {
      push({ id: 'beloved', label: 'Ulubieniec społeczności', hint: 'Średnia ocena ≥ 4.5', icon: 'thumbs', tier: 'gold' });
    }

    if (tripStats.totalKm >= 1000) push({ id: 'km1k', label: 'Tysiąc kilometrów', hint: '1000+ km łącznie', icon: 'flame', tier: 'gold' });
    else if (tripStats.totalKm >= 100) push({ id: 'km100', label: 'Setka', hint: '100+ km łącznie', icon: 'flame', tier: 'silver' });

    if (tripStats.maxSpeedKmh >= 200) push({ id: 'speed200', label: 'Demon prędkości', hint: 'Max 200+ km/h', icon: 'speed', tier: 'gold' });
    else if (tripStats.maxSpeedKmh >= 140) push({ id: 'speed140', label: 'Szybki', hint: 'Max 140+ km/h', icon: 'speed', tier: 'silver' });

    if (accountDays >= 365) push({ id: 'veteran', label: 'Weteran', hint: 'Konto > 1 rok', icon: 'calendar', tier: 'gold' });
    else if (accountDays >= 30) push({ id: 'regular', label: 'Stały bywalec', hint: 'Konto > 30 dni', icon: 'calendar', tier: 'bronze' });

    return NextResponse.json({
      user,
      stats,
      tripStats,
      records,
      publishedRoutes,
      achievements,
      friendship,
      friendshipId,
    });
  } catch (error) {
    console.error("Public profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
