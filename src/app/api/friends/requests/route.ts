import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pendingRequests = await prisma.friendship.findMany({
      where: {
        addresseeId: session.user.id,
        status: "PENDING",
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const requests = pendingRequests.map((r) => ({
      id: r.id,
      fromUser: {
        id: r.requester.id,
        name: r.requester.name,
        email: r.requester.email,
        avatarUrl: r.requester.image,
      },
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Get friend requests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
