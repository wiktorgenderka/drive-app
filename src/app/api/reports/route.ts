import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ReportType } from "@prisma/client";
import { rateLimit } from "@/lib/rateLimit";
import { CreateReportSchema } from "@/lib/schemas";
import { awardXP, touchStreak } from "@/lib/xp";
import { checkAndUnlockAchievements } from "@/lib/achievements";

const REPORT_EXPIRY_HOURS = 2;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const radius = parseFloat(searchParams.get("radius") || "10");

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: "lat and lng query parameters are required" },
        { status: 400 }
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude values" },
        { status: 400 }
      );
    }

    // Calculate bounding box for rough filtering (radius in km)
    const latDelta = radius / 111.32;
    const lngDelta = radius / (111.32 * Math.cos((lat * Math.PI) / 180));

    const reports = await prisma.report.findMany({
      where: {
        expiresAt: { gte: new Date() },
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
        votes: {
          select: { isUpvote: true, userId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Precise distance filtering using Haversine formula
    const filteredReports = reports.filter((report) => {
      const dLat = ((report.latitude - lat) * Math.PI) / 180;
      const dLng = ((report.longitude - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((report.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = 6371 * c; // Earth radius in km
      return distance <= radius;
    });

    const currentUserId = session.user.id;
    const reportsWithCounts = filteredReports.map((r) => {
      const upvotes = r.votes.filter((v) => v.isUpvote).length;
      const downvotes = r.votes.filter((v) => !v.isUpvote).length;
      const myVote = r.votes.find((v) => v.userId === currentUserId);
      const userVote = myVote ? myVote.isUpvote : null;
      const isOwner = r.userId === currentUserId;
      const { votes: _votes, ...rest } = r;
      return { ...rest, upvotes, downvotes, userVote, isOwner };
    });

    return NextResponse.json(reportsWithCounts);
  } catch (error) {
    console.error("Get reports error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(`reports:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }

  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = CreateReportSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { type, latitude, longitude, description } = parsed.data;

    const expiresAt = new Date(
      Date.now() + REPORT_EXPIRY_HOURS * 60 * 60 * 1000
    );

    const report = await prisma.report.create({
      data: {
        type: type as ReportType,
        latitude,
        longitude,
        description: description || null,
        expiresAt,
        userId: session.user.id,
      },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    try {
      const userId = session.user.id;
      const { streak } = await touchStreak(userId);
      await awardXP(userId, 'REPORT_CONFIRMED');
      const reportCount = await prisma.report.count({ where: { userId } });
      await checkAndUnlockAchievements(userId, { reportCount, streak, reportConfirmed: true });
    } catch (e) {
      console.error('Report XP error:', e);
    }

    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    console.error("Create report error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
