import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = session.user.id;
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(end.getDate() - 90);
  start.setHours(0, 0, 0, 0);

  const trips = await prisma.trip.findMany({
    where: { userId, startedAt: { gte: start } },
    select: { distanceKm: true, startedAt: true },
  });

  // Build a map of date-string → km
  const byDay: Record<string, number> = {};
  for (const trip of trips) {
    const key = new Date(trip.startedAt).toISOString().slice(0, 10);
    byDay[key] = (byDay[key] ?? 0) + (trip.distanceKm ?? 0);
  }

  // Return 91 days (today + 90 past days)
  const result: { date: string; km: number }[] = [];
  for (let i = 90; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, km: Math.round((byDay[key] ?? 0) * 10) / 10 });
  }

  return NextResponse.json(result);
}
