import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const convoy = await prisma.convoy.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                latitude: true,
                longitude: true,
              },
            },
          },
        },
        _count: { select: { members: true } },
      },
    });

    if (!convoy) {
      return NextResponse.json(
        { error: "Convoy not found" },
        { status: 404 }
      );
    }

    const isMember = convoy.members.some(
      (m) => m.userId === session.user!.id
    );

    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a member of this convoy" },
        { status: 403 }
      );
    }

    return NextResponse.json(convoy);
  } catch (error) {
    console.error("Get convoy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const convoy = await prisma.convoy.findUnique({
      where: { id },
      include: {
        members: { where: { userId: session.user.id } },
      },
    });

    if (!convoy) {
      return NextResponse.json(
        { error: "Convoy not found" },
        { status: 404 }
      );
    }

    if (convoy.members.length > 0) {
      return NextResponse.json(
        { error: "Already a member of this convoy" },
        { status: 409 }
      );
    }

    const member = await prisma.convoyMember.create({
      data: {
        convoyId: id,
        userId: session.user.id,
        role: "MEMBER",
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
        convoy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error("Join convoy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const convoy = await prisma.convoy.findUnique({
      where: { id },
      include: {
        members: { where: { userId: session.user.id } },
      },
    });

    if (!convoy) {
      return NextResponse.json(
        { error: "Convoy not found" },
        { status: 404 }
      );
    }

    if (convoy.members.length === 0) {
      return NextResponse.json(
        { error: "You are not a member of this convoy" },
        { status: 403 }
      );
    }

    if (convoy.ownerId === session.user.id) {
      return NextResponse.json(
        { error: "Owner cannot leave. Delete the convoy instead via /api/convoy" },
        { status: 400 }
      );
    }

    await prisma.convoyMember.deleteMany({
      where: {
        convoyId: id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ message: "Left convoy successfully" });
  } catch (error) {
    console.error("Leave convoy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
