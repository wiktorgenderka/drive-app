import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: friendshipId } = await context.params;

    const friendship = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      return NextResponse.json(
        { error: "Friendship not found" },
        { status: 404 }
      );
    }

    if (
      friendship.requesterId !== session.user.id &&
      friendship.addresseeId !== session.user.id
    ) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    await prisma.friendship.delete({ where: { id: friendshipId } });

    return NextResponse.json({ message: "Friend removed successfully" });
  } catch (error) {
    console.error("Delete friendship error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
