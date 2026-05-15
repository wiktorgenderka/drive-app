import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { FriendshipStatus } from "@prisma/client";
import { SendFriendRequestSchema, RespondFriendSchema } from "@/lib/schemas";
import { broadcastToChannel } from "@/lib/supabase-broadcast";
import { awardXP } from "@/lib/xp";
import { checkAndUnlockAchievements } from "@/lib/achievements";
import { sendPushToUser } from "@/lib/webpush";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));

    const userId = session.user.id;

    const [friendships, total] = await Promise.all([
      prisma.friendship.findMany({
        where: {
          OR: [
            { requesterId: userId, status: FriendshipStatus.ACCEPTED },
            { addresseeId: userId, status: FriendshipStatus.ACCEPTED },
          ],
        },
        include: {
          requester: { select: { id: true, name: true, email: true, image: true } },
          addressee: { select: { id: true, name: true, email: true, image: true } },
        },
        take: limit,
        skip: page * limit,
      }),
      prisma.friendship.count({
        where: {
          OR: [
            { requesterId: userId, status: FriendshipStatus.ACCEPTED },
            { addresseeId: userId, status: FriendshipStatus.ACCEPTED },
          ],
        },
      }),
    ]);

    const friends = friendships.map((f) => {
      const friendData = f.requesterId === userId ? f.addressee : f.requester;
      return { friendshipId: f.id, ...friendData };
    });

    return NextResponse.json({ data: friends, total, page, limit });
  } catch (error) {
    logger.error({ err: error }, "Get friends error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(`friends:${ip}`, 10, 60_000)) {
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

    const parsed = SendFriendRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { email, userId } = parsed.data;

    const targetUser = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } })
      : await prisma.user.findUnique({ where: { email: email!.toLowerCase() }, select: { id: true, name: true, email: true } });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.id === session.user.id) {
      return NextResponse.json({ error: "Cannot send friend request to yourself" }, { status: 400 });
    }

    const existingFriendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: session.user.id, addresseeId: targetUser.id },
          { requesterId: targetUser.id, addresseeId: session.user.id },
        ],
      },
    });

    if (existingFriendship) {
      return NextResponse.json({ error: "Friendship or request already exists" }, { status: 409 });
    }

    const friendship = await prisma.friendship.create({
      data: { requesterId: session.user.id, addresseeId: targetUser.id, status: "PENDING" },
      include: { addressee: { select: { id: true, name: true, email: true, image: true } } },
    });

    await broadcastToChannel(`user:${targetUser.id}`, 'friend-request', {
      fromName: session.user.name ?? 'Ktoś',
      fromId: session.user.id,
    });

    sendPushToUser(targetUser.id, {
      title: 'Nowe zaproszenie do znajomych',
      body: `${session.user.name ?? 'Ktoś'} chce dodać Cię do znajomych`,
      tag: 'friend-request',
      url: '/dashboard',
    }).catch(() => {});

    return NextResponse.json(friendship, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Send friend request error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const ctPut = request.headers.get('content-type') ?? '';
  if (!ctPut.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 });
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = RespondFriendSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { friendshipId, action } = parsed.data;

    const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });

    if (!friendship) {
      return NextResponse.json({ error: "Friendship request not found" }, { status: 404 });
    }
    if (friendship.addresseeId !== session.user.id) {
      return NextResponse.json({ error: "Only the recipient can accept or reject" }, { status: 403 });
    }
    if (friendship.status !== "PENDING") {
      return NextResponse.json({ error: "Request is no longer pending" }, { status: 400 });
    }

    if (action === "reject") {
      await prisma.friendship.update({ where: { id: friendshipId }, data: { status: "REJECTED" } });
      return NextResponse.json({ message: "Friend request rejected" });
    }

    const updated = await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: "ACCEPTED" },
      include: {
        requester: { select: { id: true, name: true, email: true, image: true } },
        addressee: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    await broadcastToChannel(`user:${updated.requesterId}`, 'friend-accepted', {
      fromName: updated.addressee.name ?? 'Ktoś',
      fromId: updated.addresseeId,
    });

    sendPushToUser(updated.requesterId, {
      title: 'Zaproszenie zaakceptowane',
      body: `${updated.addressee.name ?? 'Ktoś'} zaakceptował(a) Twoje zaproszenie`,
      tag: 'friend-accepted',
      url: '/dashboard',
    }).catch(() => {});

    try {
      const [accepterCount, requesterCount] = await Promise.all([
        prisma.friendship.count({
          where: { status: FriendshipStatus.ACCEPTED, OR: [{ requesterId: updated.addresseeId }, { addresseeId: updated.addresseeId }] },
        }),
        prisma.friendship.count({
          where: { status: FriendshipStatus.ACCEPTED, OR: [{ requesterId: updated.requesterId }, { addresseeId: updated.requesterId }] },
        }),
      ]);
      await Promise.all([
        awardXP(updated.addresseeId, 'FRIEND_ADDED'),
        awardXP(updated.requesterId, 'FRIEND_ADDED'),
        checkAndUnlockAchievements(updated.addresseeId, { friendCount: accepterCount }),
        checkAndUnlockAchievements(updated.requesterId, { friendCount: requesterCount }),
      ]);
    } catch (e) {
      logger.error({ err: e }, 'Friend XP error:');
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Update friendship error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const friendshipId = searchParams.get("friendshipId");

    if (!friendshipId) {
      return NextResponse.json({ error: "friendshipId is required" }, { status: 400 });
    }

    const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });

    if (!friendship) {
      return NextResponse.json({ error: "Friendship not found" }, { status: 404 });
    }
    if (friendship.requesterId !== session.user.id && friendship.addresseeId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    await prisma.friendship.delete({ where: { id: friendshipId } });
    return NextResponse.json({ message: "Friend removed successfully" });
  } catch (error) {
    logger.error({ err: error }, "Delete friendship error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
