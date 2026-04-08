import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const route = await prisma.route.findUnique({
      where: { id },
    });

    if (!route) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: 404 }
      );
    }

    if (route.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Not authorized to share this route" },
        { status: 403 }
      );
    }

    // Find the user's active convoy
    const membership = await prisma.convoyMember.findFirst({
      where: { userId: session.user.id },
      include: { convoy: true },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "You are not in any convoy. Join a convoy first to share routes." },
        { status: 400 }
      );
    }

    const updated = await prisma.route.update({
      where: { id },
      data: { convoyId: membership.convoyId },
    });

    return NextResponse.json({
      message: `Route shared with convoy "${membership.convoy.name}"`,
      route: updated,
    });
  } catch (error) {
    console.error("Share route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
