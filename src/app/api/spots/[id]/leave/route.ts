import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getSocketServer } from "@/lib/socket-server";
import { FriendshipStatus, SpotKind, SpotVisibility } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function emitToFriendCircle(
  event: string,
  payload: unknown,
  userIds: string[]
) {
  const io = getSocketServer();
  if (!io) return;
  for (const uid of userIds) {
    io.to(`user:${uid}`).emit(event, payload);
  }
}

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const me = session.user.id;

    const spot = await prisma.spot.findUnique({
      where: { id },
      include: {
        participants: { where: { leftAt: null }, select: { userId: true } },
      },
    });

    if (!spot) {
      return NextResponse.json({ error: "Spot not found" }, { status: 404 });
    }
    if (spot.kind !== SpotKind.AUTO) {
      return NextResponse.json(
        { error: "Only AUTO spots can be left" },
        { status: 400 }
      );
    }
    if (spot.closedAt) {
      return NextResponse.json({ error: "Spot already closed" }, { status: 400 });
    }
    if (!spot.participants.some((p) => p.userId === me)) {
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    }

    await prisma.spotParticipant.update({
      where: { spotId_userId: { spotId: id, userId: me } },
      data: { leftAt: new Date() },
    });

    const remaining = spot.participants.filter((p) => p.userId !== me).length;

    let closed = false;
    if (remaining < 2) {
      await prisma.spot.update({
        where: { id },
        data: { closedAt: new Date() },
      });
      closed = true;
    }

    // Build audience: participants + their friend circles.
    const involvedIds = spot.participants.map((p) => p.userId);
    const friendships = await prisma.friendship.findMany({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { requesterId: { in: involvedIds } },
          { addresseeId: { in: involvedIds } },
        ],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const friendsOfInvolved = friendships.flatMap((f) => [f.requesterId, f.addresseeId]);
    const audience = Array.from(new Set([...involvedIds, ...friendsOfInvolved]));

    if (closed) {
      const payload = { spotId: id };
      if (spot.visibility === SpotVisibility.PUBLIC) {
        const io = getSocketServer();
        io?.emit("spot-closed", payload);
      } else {
        await emitToFriendCircle("spot-closed", payload, audience);
      }
    } else {
      const fullSpot = await prisma.spot.findUniqueOrThrow({
        where: { id },
        include: {
          createdBy: { select: { id: true, name: true, image: true } },
          participants: {
            where: { leftAt: null },
            include: { user: { select: { id: true, name: true, image: true } } },
          },
        },
      });
      await emitToFriendCircle(
        "spot-updated",
        { ...fullSpot, isOwner: false, isParticipant: false },
        audience
      );
    }

    return NextResponse.json({ left: true, closed, id });
  } catch (error) {
    console.error("Leave spot error:", error);
    const message =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
