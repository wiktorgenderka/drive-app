import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Accepts both EventPanel naming (startAt/endAt/locationName) and legacy (date/endDate/address)
const CreateEventSchema = z.object({
  title:        z.string().min(2).max(100),
  description:  z.string().max(2000).optional(),
  startAt:      z.string().datetime().optional(),
  date:         z.string().datetime().optional(),
  endAt:        z.string().datetime().optional(),
  endDate:      z.string().datetime().optional(),
  latitude:     z.number(),
  longitude:    z.number(),
  locationName: z.string().max(200).optional(),
  address:      z.string().max(200).optional(),
  maxAttendees: z.number().int().positive().optional(),
  type:         z.enum(['MEETUP', 'TRACK_DAY', 'CONVOY_EVENT', 'CRUISE', 'CAR_SHOW', 'OTHER']).optional(),
  isPublic:     z.boolean().default(true),
}).refine((d) => d.startAt ?? d.date, { message: 'startAt or date required' });

function mapEvent(e: {
  id: string; title: string; description: string; date: Date; endDate: Date | null;
  latitude: number; longitude: number; address: string; maxAttendees: number | null;
  _count: { attendees: number }; myStatus?: string | null;
}) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    startAt: e.date.toISOString(),
    endAt: e.endDate?.toISOString() ?? null,
    latitude: e.latitude,
    longitude: e.longitude,
    locationName: e.address,
    maxAttendees: e.maxAttendees,
    _count: e._count,
    myStatus: e.myStatus ?? null,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '0');
  const lng = parseFloat(searchParams.get('lng') ?? '0');
  const radius = parseFloat(searchParams.get('radius') ?? '200');
  const upcoming = searchParams.get('upcoming') !== 'false';
  const q = searchParams.get('q')?.trim();

  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      isPublic: true,
      ...(upcoming ? { date: { gte: now } } : {}),
      ...(lat && lng ? {
        latitude:  { gte: lat - radius / 111, lte: lat + radius / 111 },
        longitude: { gte: lng - radius / 111, lte: lng + radius / 111 },
      } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
    },
    include: {
      _count: { select: { attendees: { where: { status: 'GOING' } } } },
    },
    orderBy: { date: 'asc' },
    take: 20,
  });

  const myAttendances = await prisma.eventAttendee.findMany({
    where: { userId: session.user.id, eventId: { in: events.map((e) => e.id) } },
  });
  const myMap = Object.fromEntries(myAttendances.map((a) => [a.eventId, a.status]));

  return NextResponse.json(events.map((e) => mapEvent({ ...e, myStatus: myMap[e.id] ?? null })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;
  const event = await prisma.event.create({
    data: {
      title:        d.title,
      description:  d.description ?? '',
      type:         d.type ?? 'MEETUP',
      date:         new Date(d.startAt ?? d.date!),
      endDate:      d.endAt ? new Date(d.endAt) : d.endDate ? new Date(d.endDate) : null,
      latitude:     d.latitude,
      longitude:    d.longitude,
      address:      d.locationName ?? d.address ?? '',
      maxAttendees: d.maxAttendees,
      isPublic:     d.isPublic,
      createdById:  session.user.id,
    },
  });

  return NextResponse.json({ ...event, startAt: event.date.toISOString(), locationName: event.address }, { status: 201 });
}
