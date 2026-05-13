import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: convoyId } = await params;

  // Fetch all trips recorded during this convoy, joining user data
  const trips = await prisma.trip.findMany({
    where: { convoyId },
    include: { user: { select: { id: true, name: true, image: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // Aggregate per user
  const byUser: Record<string, {
    userId: string; name: string; image: string | null;
    totalKm: number; maxSpeedKmh: number; tripCount: number;
  }> = {};

  for (const t of trips) {
    const uid = t.userId;
    if (!byUser[uid]) {
      byUser[uid] = { userId: uid, name: t.user.name ?? 'Kierowca', image: t.user.image, totalKm: 0, maxSpeedKmh: 0, tripCount: 0 };
    }
    byUser[uid].totalKm += t.distanceKm;
    byUser[uid].maxSpeedKmh = Math.max(byUser[uid].maxSpeedKmh, t.maxSpeedKmh);
    byUser[uid].tripCount += 1;
  }

  const members = Object.values(byUser).sort((a, b) => b.totalKm - a.totalKm);
  const totalKm = members.reduce((s, m) => s + m.totalKm, 0);

  return NextResponse.json({ members, totalKm, tripCount: trips.length });
}
