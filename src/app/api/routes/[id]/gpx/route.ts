import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

type RouteContext = {
  params: Promise<{ id: string }>;
};

interface Waypoint {
  lat: number;
  lng: number;
  name?: string;
  ele?: number;
}

function toGpx(name: string, description: string | null, waypoints: Waypoint[]): string {
  const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pts = waypoints
    .map((wp) => {
      const title = wp.name ? `\n      <name>${escXml(wp.name)}</name>` : '';
      const ele = wp.ele != null ? `\n      <ele>${wp.ele}</ele>` : '';
      return `  <wpt lat="${wp.lat}" lon="${wp.lng}">${title}${ele}\n  </wpt>`;
    })
    .join('\n');

  const trkpts = waypoints
    .map((wp) => {
      const ele = wp.ele != null ? `\n        <ele>${wp.ele}</ele>` : '';
      return `      <trkpt lat="${wp.lat}" lon="${wp.lng}">${ele}\n      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="DriveApp" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escXml(name)}</name>${description ? `\n    <desc>${escXml(description)}</desc>` : ''}
  </metadata>
${pts}
  <trk>
    <name>${escXml(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const route = await prisma.route.findUnique({
      where: { id },
      select: { id: true, name: true, description: true, waypoints: true, userId: true, isPublic: true },
    });

    if (!route) return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    if (!route.isPublic && route.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const waypoints = Array.isArray(route.waypoints) ? (route.waypoints as unknown as Waypoint[]) : [];
    const gpx = toGpx(route.name, route.description, waypoints);
    const filename = route.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    return new NextResponse(gpx, {
      headers: {
        'Content-Type': 'application/gpx+xml',
        'Content-Disposition': `attachment; filename="${filename}.gpx"`,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'GPX export error:');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
