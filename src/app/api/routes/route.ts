import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CreateRouteSchema } from "@/lib/schemas";
import { awardXP, touchStreak, getLevelInfo } from "@/lib/xp";
import { checkAndUnlockAchievements } from "@/lib/achievements";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    const [routes, total] = await Promise.all([
      prisma.route.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: page * limit,
      }),
      prisma.route.count({ where: { userId: session.user.id } }),
    ]);

    return NextResponse.json({ data: routes, total, page, limit });
  } catch (error) {
    logger.error({ err: error }, "Get routes error:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = CreateRouteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { name, description, waypoints, isPublic } = parsed.data;

    const route = await prisma.route.create({
      data: {
        name,
        description: description ?? null,
        waypoints,
        userId: session.user.id,
        isPublic: isPublic ?? false,
        publishedAt: isPublic ? new Date() : null,
      },
    });

    try {
      const userId = session.user.id;
      const { streak } = await touchStreak(userId);
      const xpResult = await awardXP(userId, 'ROUTE_CREATED');
      const level = xpResult ? getLevelInfo(xpResult.newTotal).current.level : 1;
      const routeCount = await prisma.route.count({ where: { userId } });
      await checkAndUnlockAchievements(userId, { routeCount, streak, level });
    } catch (e) {
      logger.error({ err: e }, 'Route XP error:');
    }

    return NextResponse.json(route, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Create route error:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get("routeId");

    if (!routeId) {
      return NextResponse.json(
        { error: "routeId is required" },
        { status: 400 }
      );
    }

    const route = await prisma.route.findUnique({
      where: { id: routeId },
    });

    if (!route) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: 404 }
      );
    }

    if (route.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Not authorized to delete this route" },
        { status: 403 }
      );
    }

    await prisma.route.delete({
      where: { id: routeId },
    });

    return NextResponse.json({ message: "Route deleted successfully" });
  } catch (error) {
    logger.error({ err: error }, "Delete route error:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
