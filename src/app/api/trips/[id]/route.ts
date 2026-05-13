import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (trip.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await prisma.trip.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
