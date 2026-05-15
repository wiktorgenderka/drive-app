import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { AutoSpotCheckSchema } from "@/lib/schemas";
import { broadcastToChannel } from "@/lib/supabase-broadcast";
import { haversineMeters } from "@/lib/geo";
import { FriendshipStatus, SpotKind, SpotVisibility } from "@prisma/client";

const NEAR_DISTANCE_M = 50;
const STILL_SPEED_MPS = 2 / 3.6;
const FRESH_LOCATION_MS = 5 * 60 * 1000;
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

async function broadcastToCircle(event: string, payload: unknown, userIds: string[]) {
  await Promise.all(userIds.map((uid) => broadcastToChannel(`user:${uid}`, event, payload)));
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "127.0.0.1";
  if (!rateLimit(`autospot:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = AutoSpotCheckSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { partnerUserId, latitude, longitude, speed } = parsed.data;

    const me = session.user.id;
    if (partnerUserId === me) {
      return NextResponse.json({ error: "Cannot pair with self" }, { status: 400 });
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId: me, addresseeId: partnerUserId },
          { requesterId: partnerUserId, addresseeId: me },
        ],
      },
      select: { id: true },
    });
    if (!friendship) {
      return NextResponse.json({ error: "Not friends" }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: me },
      data: { latitude, longitude, speed, lastLocationUpdate: new Date() },
    });

    const partner = await prisma.user.findUnique({
      where: { id: partnerUserId },
      select: { latitude: true, longitude: true, speed: true, lastLocationUpdate: true },
    });

    if (!partner?.latitude || !partner.longitude || partner.speed == null || !partner.lastLocationUpdate) {
      return NextResponse.json({ eligible: false, reason: "no-partner-location" });
    }

    if (Date.now() - partner.lastLocationUpdate.getTime() > FRESH_LOCATION_MS) {
      return NextResponse.json({ eligible: false, reason: "partner-stale" });
    }

    const distance = haversineMeters(latitude, longitude, partner.latitude, partner.longitude);
    if (distance > NEAR_DISTANCE_M) return NextResponse.json({ eligible: false, reason: "too-far", distance });
    if (speed > STILL_SPEED_MPS || partner.speed > STILL_SPEED_MPS) {
      return NextResponse.json({ eligible: false, reason: "moving" });
    }

    const existing = await prisma.spot.findFirst({
      where: {
        kind: SpotKind.AUTO,
        closedAt: null,
        expiresAt: { gt: new Date() },
        participants: { some: { leftAt: null, userId: { in: [me, partnerUserId] } } },
      },
      include: {
        createdBy: { select: { id: true, name: true, image: true } },
        participants: PARTICIPANT_INCLUDE,
      },
    });

    let action: "created" | "joined" | "noop" = "noop";
    let spotId: string;

    if (existing) {
      const meIn = existing.participants.some((p) => p.userId === me);
      const partnerIn = existing.participants.some((p) => p.userId === partnerUserId);
      const missing = !meIn ? me : !partnerIn ? partnerUserId : null;

      if (missing) {
        await prisma.spotParticipant.upsert({
          where: { spotId_userId: { spotId: existing.id, userId: missing } },
          create: { spotId: existing.id, userId: missing },
          update: { leftAt: null, joinedAt: new Date() },
        });
        action = "joined";
      }
      spotId = existing.id;
    } else {
      const created = await prisma.spot.create({
        data: {
          kind: SpotKind.AUTO,
          visibility: SpotVisibility.FRIENDS,
          latitude: (latitude + partner.latitude) / 2,
          longitude: (longitude + partner.longitude) / 2,
          createdById: me,
          expiresAt: new Date(Date.now() + SPOT_EXPIRY_HOURS * 60 * 60 * 1000),
          participants: { create: [{ userId: me }, { userId: partnerUserId }] },
        },
      });
      spotId = created.id;
      action = "created";
    }

    const fullSpot = await prisma.spot.findUniqueOrThrow({
      where: { id: spotId },
      include: {
        createdBy: { select: { id: true, name: true, image: true } },
        participants: PARTICIPANT_INCLUDE,
      },
    });

    const myFriends = await getFriendIds(me);
    const partnerFriends = await getFriendIds(partnerUserId);
    const audience = Array.from(new Set([me, partnerUserId, ...myFriends, ...partnerFriends]));

    if (action === "created") {
      await broadcastToCircle('spot-created', { ...fullSpot, isOwner: false, isParticipant: false }, audience);
    } else if (action === "joined") {
      await broadcastToCircle('spot-updated', { ...fullSpot, isOwner: false, isParticipant: false }, audience);
    }

    return NextResponse.json({
      eligible: true,
      action,
      spot: {
        ...fullSpot,
        isOwner: fullSpot.createdById === me,
        isParticipant: fullSpot.participants.some((p) => p.userId === me),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Auto-spot check error:");
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
