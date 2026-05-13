import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const PatchSchema = z.object({
  make:       z.string().min(1).max(60).optional(),
  model:      z.string().min(1).max(80).optional(),
  year:       z.number().int().min(1900).optional(),
  color:      z.string().max(40).optional(),
  photos:     z.array(z.string()).max(6).optional(),
  mods:       z.string().max(2000).optional(),
  horsepower: z.number().int().positive().optional(),
  torque:     z.number().int().positive().optional(),
  engine:     z.string().max(80).optional(),
  isActive:   z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle || vehicle.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.isActive) {
    await prisma.vehicle.updateMany({
      where: { userId: session.user.id, id: { not: id } },
      data: { isActive: false },
    });
  }

  const updated = await prisma.vehicle.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle || vehicle.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.vehicle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
