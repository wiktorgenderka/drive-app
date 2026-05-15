import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
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

  if (!route) {
    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  }

  return NextResponse.json(route);
}
