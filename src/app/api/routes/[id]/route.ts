import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UpdateRouteSchema } from "@/lib/schemas";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const parsed = UpdateRouteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.route.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }
    if (existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const data: {
      name?: string;
      description?: string | null;
      isPublic?: boolean;
      publishedAt?: Date | null;
    } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.description !== undefined) data.description = parsed.data.description;
    if (parsed.data.isPublic !== undefined) {
      data.isPublic = parsed.data.isPublic;
      data.publishedAt = parsed.data.isPublic
        ? (existing.publishedAt ?? new Date())
        : null;
    }

    const updated = await prisma.route.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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
        { error: "Not authorized to delete this route" },
        { status: 403 }
      );
    }

    await prisma.route.delete({ where: { id } });

    return NextResponse.json({ message: "Route deleted successfully" });
  } catch (error) {
    console.error("Delete route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
