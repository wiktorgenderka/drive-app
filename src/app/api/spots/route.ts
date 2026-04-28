import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { CreateSpotSchema } from "@/lib/schemas";
import { broadcastToChannel } from "@/lib/supabase-broadcast";
import { FriendshipStatus, SpotKind, SpotVisibility } from "@prisma/client";

const SPOT_EXPIRY_HOURS = 2;

const PARTICIPANT_INCLUDE = {
  where: { leftAt: null },
  include: { user: { select: { id: true, name: true, image: true } } },
} as const;

async function getFriendIds(userId: string): Promise<string[]> {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: FriendshipStatus.ACCEPTED,
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  return friendships.map((f) =>
    f.requesterId === userId ? f.addresseeId : f.requesterId
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const radius = parseFloat(searchParams.get("radius") || "50");

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json({ error: "Invalid lat/lng" }, { status: 400 });
    }

    const userId = session.user.id;
    const friendIds = await getFriendIds(userId);
    const visibleAuthorIds = [userId, ...friendIds];

    const latDelta = radius / 111.32;
    const lngDelta = radius / (111.32 * Math.cos((lat * Math.PI) / 180));

    const spots = await prisma.spot.findMany({
      where: {
        closedAt: null,
        expiresAt: { gte: new Date() },
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
        OR: [
          { visibility: SpotVisibility.PUBLIC },
          {
            visibility: SpotVisibility.FRIENDS,
            OR: [
              { createdById: { in: visibleAuthorIds } },
              { participants: { some: { userId: { in: visibleAuthorIds }, leftAt: null } } },
            ],
          },
        ],
      },
      include: {
        createdBy: { select: { id: true, name: true, image: true } },
        participants: PARTICIPANT_INCLUDE,
      },
      orderBy: { createdAt: "desc" },
    });

    const filtered = spots.filter((s) => {
      const dLat = ((s.latitude - lat) * Math.PI) / 180;
      const dLng = ((s.longitude - lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((s.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return 6371 * c <= radius;
    });

    const result = filtered.map((s) => ({
      ...s,
      isOwner: s.createdById === userId,
      isParticipant: s.participants.some((p) => p.userId === userId),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get spots error:", error);
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "127.0.0.1";
  if (!rateLimit(`spots:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = CreateSpotSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { visibility, latitude, longitude, title, description } = parsed.data;

    const expiresAt = new Date(Date.now() + SPOT_EXPIRY_HOURS * 60 * 60 * 1000);

    const spot = await prisma.spot.create({
      data: {
        kind: SpotKind.MANUAL,
        visibility: visibility as SpotVisibility,
        latitude,
        longitude,
        title: title || null,
        description: description || null,
        expiresAt,
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, image: true } },
        participants: PARTICIPANT_INCLUDE,
      },
    });

    const payload = { ...spot, isOwner: false, isParticipant: false };

    if (visibility === "PUBLIC") {
      await broadcastToChannel('public', 'spot-created', payload);
    } else {
      const friendIds = await getFriendIds(session.user.id);
      await Promise.all(
        [session.user.id, ...friendIds].map((fid) =>
          broadcastToChannel(`user:${fid}`, 'spot-created', payload)
        )
      );
    }

    return NextResponse.json({ ...spot, isOwner: true, isParticipant: false }, { status: 201 });
  } catch (error) {
    console.error("Create spot error:", error);
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
