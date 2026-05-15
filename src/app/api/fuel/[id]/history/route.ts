import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { FuelType } from '@prisma/client';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: stationId } = await context.params;
    const { searchParams } = new URL(request.url);
    const fuelType = searchParams.get('fuelType') as FuelType | null;
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') ?? '30', 10) || 30));

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = { stationId, recordedAt: { gte: since } };
    if (fuelType && Object.values(FuelType).includes(fuelType)) {
      where.fuelType = fuelType;
    }

    const history = await prisma.fuelPriceHistory.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      select: { fuelType: true, price: true, recordedAt: true },
    });

    return NextResponse.json({ history, days });
  } catch (error) {
    console.error('Fuel price history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
