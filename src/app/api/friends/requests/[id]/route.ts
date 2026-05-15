import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ error: 'Unsupported Media Type' }, { status: 415 });

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { action } = body;

    if (!action || !["accept", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be 'accept' or 'reject'" },
        { status: 400 }
      );
    }

    const friendship = await prisma.friendship.findUnique({
      where: { id },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: "Friend request not found" },
        { status: 404 }
      );
    }

    if (friendship.addresseeId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the recipient can accept or reject" },
        { status: 403 }
      );
    }

    if (friendship.status !== "PENDING") {
      return NextResponse.json(
        { error: "Request is no longer pending" },
        { status: 400 }
      );
    }

    const newStatus = action === "accept" ? "ACCEPTED" : "REJECTED";

    const updated = await prisma.friendship.update({
      where: { id },
      data: { status: newStatus },
      include: {
        requester: {
          select: { id: true, name: true, email: true, image: true },
        },
        addressee: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Update friend request error:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
