import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { status = 'GOING' } = await req.json();

  if (!['GOING', 'MAYBE', 'NOT_GOING'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const attendee = await prisma.eventAttendee.upsert({
    where: { eventId_userId: { eventId: id, userId: session.user.id } },
    update: { status },
    create:  { eventId: id, userId: session.user.id, status },
  });

  return NextResponse.json(attendee);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  await prisma.eventAttendee.deleteMany({
    where: { eventId: id, userId: session.user.id },
  });
  return NextResponse.json({ ok: true });
}
