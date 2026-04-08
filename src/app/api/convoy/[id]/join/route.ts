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
