import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: routeId } = await params;

    // Get IDs of accepted friends
    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: session.user.id }, { addresseeId: session.user.id }],
      },
      select: { requesterId: true, addresseeId: true },
    });

    const friendIds = friendships.map((f) =>
      f.requesterId === session.user.id ? f.addresseeId : f.requesterId
    );

    const allowedIds = [session.user.id, ...friendIds];

    // Best time per user for this route
    const times = await prisma.routeTime.findMany({
      where: { routeId, userId: { in: allowedIds } },
      orderBy: { seconds: "asc" },
      include: { user: { select: { id: true, name: true, image: true } } },
    });

    // Deduplicate — keep only best time per user
    const seen = new Set<string>();
    const leaderboard = times.filter((t) => {
      if (seen.has(t.userId)) return false;
      seen.add(t.userId);
      return true;
    });

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error("Get route times error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: routeId } = await params;
    const body = await req.json();
    const seconds = Number(body?.seconds);

    if (!Number.isInteger(seconds) || seconds <= 0) {
      return NextResponse.json({ error: "Invalid seconds value" }, { status: 400 });
    }

    const route = await prisma.route.findUnique({ where: { id: routeId } });
    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    const record = await prisma.routeTime.create({
      data: { routeId, userId: session.user.id, seconds },
      include: { user: { select: { id: true, name: true, image: true } } },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Save route time error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
