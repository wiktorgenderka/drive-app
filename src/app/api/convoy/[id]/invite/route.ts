import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { broadcastToChannel } from "@/lib/supabase-broadcast";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: convoyId } = await context.params;
    const { userId } = await request.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const convoy = await prisma.convoy.findUnique({
      where: { id: convoyId },
      include: { members: { select: { userId: true } } },
    });

    if (!convoy) {
      return NextResponse.json({ error: "Convoy not found" }, { status: 404 });
    }

    const callerIsMember = convoy.members.some((m) => m.userId === session.user!.id);
    if (!callerIsMember) {
      return NextResponse.json({ error: "You are not a member of this convoy" }, { status: 403 });
    }

    const alreadyMember = convoy.members.some((m) => m.userId === userId);
    if (alreadyMember) {
      return NextResponse.json({ error: "User is already a member" }, { status: 409 });
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: session.user.id, addresseeId: userId },
          { requesterId: userId, addresseeId: session.user.id },
        ],
      },
    });

    if (!friendship) {
      return NextResponse.json({ error: "You can only invite friends" }, { status: 403 });
    }

    const member = await prisma.convoyMember.create({
      data: { convoyId, userId, role: "MEMBER" },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
    });

    await broadcastToChannel(`user:${userId}`, 'convoy-invite', {
      convoyId,
      convoyName: convoy.name,
      invitedByName: session.user.name ?? 'Ktoś',
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Invite to convoy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
