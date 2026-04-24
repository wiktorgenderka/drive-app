import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CreateTripSchema } from "@/lib/schemas";

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
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = CreateTripSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { startedAt, endedAt, distanceKm, maxSpeedKmh, avgSpeedKmh, durationMin, vehicleId, convoyId } = parsed.data;

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
      },
    });

    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    console.error("Create trip error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
