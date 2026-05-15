import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;

    const route = await prisma.route.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        name: true,
        description: true,
        waypoints: true,
        avgRating: true,
        ratingCount: true,
        createdAt: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });

    if (!route) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(route);
  } catch (err) {
    logger.error({ err }, 'GET /api/routes/shared/[token] error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
