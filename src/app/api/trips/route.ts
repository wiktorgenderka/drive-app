import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CreateTripSchema } from "@/lib/schemas";
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

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where: { userId: session.user.id },
        orderBy: { startedAt: "desc" },
        take: limit,
        skip: page * limit,
      }),
      prisma.trip.count({ where: { userId: session.user.id } }),
    ]);

    return NextResponse.json({ data: trips, total, page, limit });
  } catch (error) {
    console.error("Get trips error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = CreateTripSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { startedAt, endedAt, distanceKm, maxSpeedKmh, avgSpeedKmh, durationMin, vehicleId, convoyId, waypoints } = parsed.data;

    const trip = await prisma.trip.create({
      data: {
        userId: session.user.id,
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt),
        distanceKm,
        maxSpeedKmh,
        avgSpeedKmh,
        durationMin,
        vehicleId: vehicleId ?? null,
        convoyId: convoyId ?? null,
        ...(waypoints ? { waypoints } : {}),
      },
    });

    try {
      const userId = session.user.id;
      const { streak } = await touchStreak(userId);
      const xpResult = await awardXP(userId, 'TRIP_COMPLETED');
      const level = xpResult ? getLevelInfo(xpResult.newTotal).current.level : 1;
      const [tripCount, totalDistanceRaw] = await Promise.all([
        prisma.trip.count({ where: { userId } }),
        prisma.trip.aggregate({ where: { userId }, _sum: { distanceKm: true } }),
      ]);
      const totalDistanceKm = totalDistanceRaw._sum.distanceKm ?? 0;
      const lastTripHour = new Date(endedAt).getHours();
      await checkAndUnlockAchievements(userId, {
        tripCount, streak, level, lastTripHour,
        tripDistanceKm: distanceKm ?? 0,
        totalDistanceKm,
      });
    } catch (e) {
      console.error('Trip XP error:', e);
    }

    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    console.error("Create trip error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
