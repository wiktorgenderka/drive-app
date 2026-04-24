import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CreateConvoySchema } from "@/lib/schemas";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const convoys = await prisma.convoy.findMany({
      where: {
        members: {
          some: { userId: session.user.id },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(convoys);
  } catch (error) {
    console.error("Get convoys error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = CreateConvoySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { name } = parsed.data;

    const convoy = await prisma.convoy.create({
      data: {
        name: name.trim(),
        ownerId: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    return NextResponse.json(convoy, { status: 201 });
  } catch (error) {
    console.error("Create convoy error:", error);
    if (
      error != null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "User not found. Please log out and log back in." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { convoyId, name } = body;

    if (!convoyId) {
      return NextResponse.json(
        { error: "convoyId is required" },
        { status: 400 }
      );
    }

    const convoy = await prisma.convoy.findUnique({
      where: { id: convoyId },
    });

    if (!convoy) {
      return NextResponse.json(
        { error: "Convoy not found" },
        { status: 404 }
      );
    }

    if (convoy.ownerId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the owner can update the convoy" },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name must be a non-empty string" },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const updatedConvoy = await prisma.convoy.update({
      where: { id: convoyId },
      data: updateData,
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedConvoy);
  } catch (error) {
    console.error("Update convoy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const convoyId = searchParams.get("convoyId");

    if (!convoyId) {
      return NextResponse.json(
        { error: "convoyId is required" },
        { status: 400 }
      );
    }

    const convoy = await prisma.convoy.findUnique({
      where: { id: convoyId },
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
      await prisma.$transaction([
        prisma.convoyMember.deleteMany({ where: { convoyId } }),
        prisma.convoy.delete({ where: { id: convoyId } }),
      ]);
      return NextResponse.json({ message: "Convoy deleted successfully" });
    }

    await prisma.convoyMember.deleteMany({
      where: {
        convoyId,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ message: "Left convoy successfully" });
  } catch (error) {
    console.error("Delete/leave convoy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
