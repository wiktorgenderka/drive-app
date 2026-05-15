import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// Globalny ranking publicznej trasy: najlepszy czas każdego użytkownika, top 5.
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: routeId } = await context.params;

    const route = await prisma.route.findUnique({ where: { id: routeId } });
    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }
    if (!route.isPublic) {
      return NextResponse.json({ error: "Route is not public" }, { status: 403 });
    }

    // Najlepszy czas per użytkownik (groupBy → join do user)
    const grouped = await prisma.routeTime.groupBy({
      by: ["userId"],
      where: { routeId },
      _min: { seconds: true },
      _count: { _all: true },
    });
    grouped.sort((a, b) => (a._min.seconds ?? 0) - (b._min.seconds ?? 0));
    const top = grouped.slice(0, 5);

    if (top.length === 0) {
      return NextResponse.json({ entries: [] });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: top.map((t) => t.userId) } },
      select: { id: true, name: true, image: true, carDisplay: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const entries = top
      .map((t) => {
        const u = userMap.get(t.userId);
        if (!u || t._min.seconds == null) return null;
        return {
          userId: t.userId,
          seconds: t._min.seconds,
          attempts: t._count._all,
          user: u,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return NextResponse.json({ entries });
  } catch (error) {
    logger.error({ err: error }, "Route leaderboard error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
