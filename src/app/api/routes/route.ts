import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const routes = await prisma.route.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(routes);
  } catch (error) {
    console.error("Get routes error:", error);
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

    const body = await request.json();
    const { name, description, waypoints } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Route name is required" },
        { status: 400 }
      );
    }

    if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
      return NextResponse.json(
        { error: "At least 2 waypoints are required" },
        { status: 400 }
      );
    }

    // Validate each waypoint has lat/lng
    for (const wp of waypoints) {
      if (
        typeof wp.latitude !== "number" ||
        typeof wp.longitude !== "number" ||
        wp.latitude < -90 ||
        wp.latitude > 90 ||
        wp.longitude < -180 ||
        wp.longitude > 180
      ) {
        return NextResponse.json(
          { error: "Each waypoint must have valid latitude and longitude" },
          { status: 400 }
        );
      }
    }

    const route = await prisma.route.create({
      data: {
        name: name.trim(),
        description: description || null,
        waypoints,
        userId: session.user.id,
      },
    });

    return NextResponse.json(route, { status: 201 });
  } catch (error) {
    console.error("Create route error:", error);
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
    const routeId = searchParams.get("routeId");

    if (!routeId) {
      return NextResponse.json(
        { error: "routeId is required" },
        { status: 400 }
      );
    }

    const route = await prisma.route.findUnique({
      where: { id: routeId },
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

    await prisma.route.delete({
      where: { id: routeId },
    });

    return NextResponse.json({ message: "Route deleted successfully" });
  } catch (error) {
    console.error("Delete route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
