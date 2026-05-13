import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;

  // Build last 7 days (today inclusive)
  const days: { date: Date; label: string }[] = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const label = d.toLocaleDateString('pl-PL', { weekday: 'short' });
    days.push({ date: d, label });
  }

  const weekStart = new Date(days[0].date);
  const trips = await prisma.trip.findMany({
    where: { userId, startedAt: { gte: weekStart } },
    select: { distanceKm: true, durationMin: true, startedAt: true },
  });

  const result = days.map(({ date, label }) => {
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    const dayTrips = trips.filter((t) => {
      const s = new Date(t.startedAt);
      return s >= date && s <= dayEnd;
    });
    const km = dayTrips.reduce((sum, t) => sum + (t.distanceKm ?? 0), 0);
    const minutes = dayTrips.reduce((sum, t) => sum + (t.durationMin ?? 0), 0);
    return { label, km: Math.round(km * 10) / 10, minutes, trips: dayTrips.length };
  });

  return NextResponse.json(result);
}
