import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getSocketServer } from "@/lib/socket-server";
import { FriendshipStatus, SpotVisibility } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const spot = await prisma.spot.findUnique({ where: { id } });
    if (!spot) {
      return NextResponse.json({ error: "Spot not found" }, { status: 404 });
    }

    // PR1: only the creator can close (manual spots).
    // PR2 will allow any participant for AUTO spots.
    if (spot.createdById !== session.user.id) {
      return NextResponse.json(
        { error: "Only the creator can close this spot" },
        { status: 403 }
      );
    }

    if (spot.closedAt) {
      return NextResponse.json({ error: "Spot already closed" }, { status: 400 });
    }

    const updated = await prisma.spot.update({
      where: { id },
      data: { closedAt: new Date() },
    });

    const io = getSocketServer();
    if (io) {
      const payload = { spotId: id };
      if (updated.visibility === SpotVisibility.PUBLIC) {
        io.emit("spot-closed", payload);
      } else {
        const friendships = await prisma.friendship.findMany({
          where: {
            status: FriendshipStatus.ACCEPTED,
            OR: [
              { requesterId: session.user.id },
              { addresseeId: session.user.id },
            ],
          },
          select: { requesterId: true, addresseeId: true },
        });
        const friendIds = friendships.map((f) =>
          f.requesterId === session.user!.id ? f.addresseeId : f.requesterId
        );
        for (const fid of [session.user.id, ...friendIds]) {
          io.to(`user:${fid}`).emit("spot-closed", payload);
        }
      }
    }

    return NextResponse.json({ closed: true, id });
  } catch (error) {
    console.error("Close spot error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
