import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CreateEventSchema = z.object({
  title:       z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  type:        z.enum(['MEETUP', 'TRACK_DAY', 'CONVOY_EVENT', 'CRUISE', 'CAR_SHOW', 'OTHER']),
  date:        z.string().datetime(),
  endDate:     z.string().datetime().optional(),
  latitude:    z.number(),
  longitude:   z.number(),
  address:     z.string().min(3).max(200),
  maxAttendees: z.number().int().positive().optional(),
  imageData:   z.string().optional(),
  isPublic:    z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '0');
  const lng = parseFloat(searchParams.get('lng') ?? '0');
  const radius = parseFloat(searchParams.get('radius') ?? '100');
  const upcoming = searchParams.get('upcoming') !== 'false';

  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      isPublic: true,
      ...(upcoming ? { date: { gte: now } } : {}),
      ...(lat && lng ? {
        latitude:  { gte: lat - radius / 111, lte: lat + radius / 111 },
        longitude: { gte: lng - radius / 111, lte: lng + radius / 111 },
      } : {}),
    },
    include: {
      createdBy: { select: { id: true, name: true, image: true } },
      _count: { select: { attendees: { where: { status: 'GOING' } } } },
    },
    orderBy: { date: 'asc' },
    take: 50,
  });

  const myAttendances = await prisma.eventAttendee.findMany({
    where: { userId: session.user.id, eventId: { in: events.map((e) => e.id) } },
  });
  const myMap = Object.fromEntries(myAttendances.map((a) => [a.eventId, a.status]));

  return NextResponse.json(events.map((e) => ({
    ...e,
    goingCount: e._count.attendees,
    myStatus: myMap[e.id] ?? null,
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const event = await prisma.event.create({
    data: { ...parsed.data, createdById: session.user.id },
  });

  return NextResponse.json(event, { status: 201 });
}
