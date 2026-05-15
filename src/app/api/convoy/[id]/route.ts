import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
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
    logger.error({ err: error }, "Get convoy error:");
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
    logger.error({ err: error }, "Join convoy error:");
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
      // Owner deletes the whole convoy
      await prisma.$transaction([
        prisma.convoyMember.deleteMany({ where: { convoyId: id } }),
        prisma.convoy.delete({ where: { id } }),
      ]);
      return NextResponse.json({ message: "Convoy deleted successfully" });
    }

    await prisma.convoyMember.deleteMany({ where: { convoyId: id, userId: session.user.id } });
    return NextResponse.json({ message: "Left convoy successfully" });
  } catch (error) {
    logger.error({ err: error }, "Leave/delete convoy error:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { name, destLat, destLng, destName } = body;

    const convoy = await prisma.convoy.findUnique({ where: { id } });

    if (!convoy) {
      return NextResponse.json({ error: "Convoy not found" }, { status: 404 });
    }

    if (convoy.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Only the owner can update the convoy" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "Name must be a non-empty string" }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (destLat !== undefined) updateData.destLat = typeof destLat === "number" ? destLat : null;
    if (destLng !== undefined) updateData.destLng = typeof destLng === "number" ? destLng : null;
    if (destName !== undefined) updateData.destName = typeof destName === "string" ? destName : null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.convoy.update({
      where: { id },
      data: updateData,
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error({ err: error }, "Update convoy error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
