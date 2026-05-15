import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

interface Waypoint {
  lat: number;
  lng: number;
  name?: string;
  ele?: number;
}

function parseGpx(xml: string): { name: string; waypoints: Waypoint[] } {
  const getName = (tag: string): string => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>\\s*<name>([^<]+)<\\/name>`));
    return m ? m[1].trim() : '';
  };

  const routeName = getName('rte') || getName('trk') || getName('gpx') || 'Imported Route';

  const waypoints: Waypoint[] = [];

  // Parse <trkpt> and <wpt> elements
  const ptRegex = /<(?:trkpt|wpt)\s[^>]*lat="([\d.\-]+)"[^>]*lon="([\d.\-]+)"[^>]*>([\s\S]*?)<\/(?:trkpt|wpt)>/g;
  let match;
  while ((match = ptRegex.exec(xml)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    const inner = match[3];
    const nameMatch = inner.match(/<name>([^<]+)<\/name>/);
    const eleMatch = inner.match(/<ele>([\d.\-]+)<\/ele>/);
    if (!isNaN(lat) && !isNaN(lng)) {
      waypoints.push({
        lat,
        lng,
        ...(nameMatch ? { name: nameMatch[1].trim() } : {}),
        ...(eleMatch ? { ele: parseFloat(eleMatch[1]) } : {}),
      });
    }
  }

  // Deduplicate consecutive identical points and subsample if too many
  const unique = waypoints.filter((wp, i) => {
    if (i === 0) return true;
    const prev = waypoints[i - 1];
    return wp.lat !== prev.lat || wp.lng !== prev.lng;
  });

  // Keep max 200 waypoints by subsampling
  if (unique.length > 200) {
    const step = Math.ceil(unique.length / 200);
    const sampled: Waypoint[] = [];
    for (let i = 0; i < unique.length; i += step) sampled.push(unique[i]);
    if (sampled[sampled.length - 1] !== unique[unique.length - 1]) {
      sampled.push(unique[unique.length - 1]);
    }
    return { name: routeName, waypoints: sampled };
  }

  return { name: routeName, waypoints: unique };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ct = request.headers.get('content-type') ?? '';
    if (!ct.includes('text/xml') && !ct.includes('application/gpx') && !ct.includes('application/xml') && !ct.includes('text/plain')) {
      return NextResponse.json({ error: 'Expected GPX/XML content' }, { status: 415 });
    }

    const text = await request.text();
    if (!text.includes('<gpx') && !text.includes('<trk') && !text.includes('<wpt')) {
      return NextResponse.json({ error: 'Invalid GPX file' }, { status: 400 });
    }

    const { name, waypoints } = parseGpx(text);
    if (waypoints.length === 0) {
      return NextResponse.json({ error: 'No waypoints found in GPX' }, { status: 400 });
    }

    const route = await prisma.route.create({
      data: {
        name,
        description: `Trasa zaimportowana z pliku GPX`,
        waypoints: waypoints as never,
        userId: session.user.id,
        isPublic: false,
      },
    });

    return NextResponse.json({ id: route.id, name: route.name, waypointCount: waypoints.length }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'GPX import error:');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
