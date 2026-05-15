import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { FuelType } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: stationId } = await context.params;

    const station = await prisma.fuelStation.findUnique({
      where: { id: stationId },
    });

    if (!station) {
      return NextResponse.json(
        { error: "Fuel station not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fuelType = searchParams.get("fuelType");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const whereClause: Record<string, unknown> = { stationId };
    if (fuelType) {
      whereClause.fuelType = fuelType;
    }

    const prices = await prisma.fuelPrice.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      take: Math.min(limit, 100),
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    return NextResponse.json({
      station: {
        id: station.id,
        name: station.name,
        address: station.address,
        brand: station.brand,
      },
      prices,
    });
  } catch (error) {
    console.error("Get fuel prices error:", error);
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

    const { id: stationId } = await context.params;

    const station = await prisma.fuelStation.findUnique({
      where: { id: stationId },
    });

    if (!station) {
      return NextResponse.json(
        { error: "Fuel station not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { fuelType, price } = body;

    const validFuelTypes = Object.values(FuelType);
    if (!fuelType || !validFuelTypes.includes(fuelType as FuelType)) {
      return NextResponse.json(
        { error: `fuelType must be one of: ${validFuelTypes.join(", ")}` },
        { status: 400 }
      );
    }

    if (typeof price !== "number" || price <= 0) {
      return NextResponse.json(
        { error: "price must be a positive number" },
        { status: 400 }
      );
    }

    // Check for existing price entry by this user for this fuel type
    const typedFuelType = fuelType as FuelType;
    const existingPrice = await prisma.fuelPrice.findFirst({
      where: {
        stationId,
        fuelType: typedFuelType,
        userId: session.user.id,
      },
    });

    const historyEntry = { stationId, fuelType: typedFuelType, price, userId: session.user.id };

    if (existingPrice) {
      const [updatedPrice] = await prisma.$transaction([
        prisma.fuelPrice.update({
          where: { id: existingPrice.id },
          data: { price },
          include: { user: { select: { id: true, name: true } } },
        }),
        prisma.fuelPriceHistory.create({ data: historyEntry }),
      ]);
      return NextResponse.json(updatedPrice);
    }

    const [newPrice] = await prisma.$transaction([
      prisma.fuelPrice.create({
        data: { stationId, fuelType: typedFuelType, price, userId: session.user.id },
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.fuelPriceHistory.create({ data: historyEntry }),
    ]);

    return NextResponse.json(newPrice, { status: 201 });
  } catch (error) {
    console.error("Add fuel price error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
