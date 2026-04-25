import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const source = await prisma.route.findUnique({ where: { id } });
    if (!source || !source.isPublic) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }
    if (source.userId === session.user.id) {
      return NextResponse.json({ error: "To Twoja własna trasa" }, { status: 400 });
    }

    const copy = await prisma.route.create({
      data: {
        name: source.name,
        description: source.description,
        waypoints: source.waypoints as Prisma.InputJsonValue,
        userId: session.user.id,
        isPublic: false,
        importedFromId: source.id,
      },
    });

    return NextResponse.json(copy, { status: 201 });
  } catch (error) {
    console.error("Import public route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
