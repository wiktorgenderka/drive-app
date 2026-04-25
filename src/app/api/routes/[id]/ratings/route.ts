import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function recomputeAggregates(routeId: string) {
  const agg = await prisma.routeRating.aggregate({
    where: { routeId },
    _avg: { stars: true },
    _count: { _all: true },
  });
  await prisma.route.update({
    where: { id: routeId },
    data: {
      avgRating: agg._count._all > 0 ? agg._avg.stars : null,
      ratingCount: agg._count._all,
    },
  });
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: routeId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const stars = Number(body?.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return NextResponse.json({ error: "Stars must be integer 1-5" }, { status: 400 });
    }

    const route = await prisma.route.findUnique({ where: { id: routeId } });
    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }
    if (!route.isPublic) {
      return NextResponse.json({ error: "Route is not public" }, { status: 400 });
    }
    if (route.userId === session.user.id) {
      return NextResponse.json({ error: "Nie możesz ocenić własnej trasy" }, { status: 400 });
    }

    await prisma.routeRating.upsert({
      where: { routeId_userId: { routeId, userId: session.user.id } },
      create: { routeId, userId: session.user.id, stars },
      update: { stars },
    });
    await recomputeAggregates(routeId);

    const updated = await prisma.route.findUnique({
      where: { id: routeId },
      select: { avgRating: true, ratingCount: true },
    });
    return NextResponse.json({ ...updated, myStars: stars });
  } catch (error) {
    console.error("Rate route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: routeId } = await context.params;
    await prisma.routeRating.deleteMany({
      where: { routeId, userId: session.user.id },
    });
    await recomputeAggregates(routeId);

    const updated = await prisma.route.findUnique({
      where: { id: routeId },
      select: { avgRating: true, ratingCount: true },
    });
    return NextResponse.json({ ...updated, myStars: null });
  } catch (error) {
    console.error("Unrate route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
