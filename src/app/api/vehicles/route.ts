import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const VehicleSchema = z.object({
  make:       z.string().min(1).max(60),
  model:      z.string().min(1).max(80),
  year:       z.number().int().min(1900).max(new Date().getFullYear() + 2),
  color:      z.string().max(40).optional(),
  photos:     z.array(z.string()).max(6).default([]),
  mods:       z.string().max(2000).optional(),
  horsepower: z.number().int().positive().optional(),
  torque:     z.number().int().positive().optional(),
  engine:     z.string().max(80).optional(),
  isActive:   z.boolean().default(false),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const vehicles = await prisma.vehicle.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  const statsArr = await Promise.all(
    vehicles.map((v) =>
      prisma.trip.aggregate({
        where: { userId: session.user.id, vehicleId: v.id },
        _sum: { distanceKm: true, durationMin: true },
        _count: { id: true },
        _max: { maxSpeedKmh: true },
      })
    )
  );

  const result = vehicles.map((v, i) => ({
    ...v,
    tripStats: {
      totalKm: statsArr[i]._sum.distanceKm ?? 0,
      totalMin: statsArr[i]._sum.durationMin ?? 0,
      tripCount: statsArr[i]._count.id,
      maxSpeedKmh: statsArr[i]._max.maxSpeedKmh ?? 0,
    },
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ error: 'Unsupported Media Type' }, { status: 415 });

  const body = await req.json();
  const parsed = VehicleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // If this is set as active, deactivate all others first
  if (parsed.data.isActive) {
    await prisma.vehicle.updateMany({
      where: { userId: session.user.id },
      data: { isActive: false },
    });
  }

  const vehicle = await prisma.vehicle.create({
    data: { ...parsed.data, userId: session.user.id },
  });
  return NextResponse.json(vehicle, { status: 201 });
}
