import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { broadcastToChannel } from "@/lib/supabase-broadcast";
import { FriendshipStatus, SpotKind, SpotVisibility } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const spot = await prisma.spot.findUnique({ where: { id } });

    if (!spot) return NextResponse.json({ error: "Spot not found" }, { status: 404 });
    if (spot.kind === SpotKind.AUTO) {
      return NextResponse.json({ error: "AUTO spots cannot be closed manually — leave instead" }, { status: 400 });
    }
    if (spot.createdById !== session.user.id) {
      return NextResponse.json({ error: "Only the creator can close this spot" }, { status: 403 });
    }
    if (spot.closedAt) {
      return NextResponse.json({ error: "Spot already closed" }, { status: 400 });
    }

    const updated = await prisma.spot.update({ where: { id }, data: { closedAt: new Date() } });
    const payload = { spotId: id };

    if (updated.visibility === SpotVisibility.PUBLIC) {
      await broadcastToChannel('public', 'spot-closed', payload);
    } else {
      const friendships = await prisma.friendship.findMany({
        where: {
          status: FriendshipStatus.ACCEPTED,
          OR: [{ requesterId: session.user.id }, { addresseeId: session.user.id }],
        },
        select: { requesterId: true, addresseeId: true },
      });
      const friendIds = friendships.map((f) =>
        f.requesterId === session.user!.id ? f.addresseeId : f.requesterId
      );
      await Promise.all(
        [session.user.id, ...friendIds].map((fid) =>
          broadcastToChannel(`user:${fid}`, 'spot-closed', payload)
        )
      );
    }

    return NextResponse.json({ closed: true, id });
  } catch (error) {
    console.error("Close spot error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
