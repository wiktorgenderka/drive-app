import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { waypointsToGPX } from '@/lib/gpx';
import type { Prisma } from '@prisma/client';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const route = await prisma.route.findUnique({ where: { id } });

  if (!route) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (route.userId !== session.user.id && !route.isPublic) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const waypoints = (route.waypoints as Prisma.JsonArray).map((w) => {
    const wp = w as { latitude: number; longitude: number; name?: string };
    return { latitude: wp.latitude, longitude: wp.longitude, name: wp.name };
  });

  const gpx = waypointsToGPX(route.name, waypoints);

  return new NextResponse(gpx, {
    headers: {
      'Content-Type': 'application/gpx+xml',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(route.name)}.gpx"`,
    },
  });
}
