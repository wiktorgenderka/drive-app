import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/collections/[id]/routes — add a route to the collection
export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: collectionId } = await ctx.params;
  const col = await prisma.routeCollection.findUnique({ where: { id: collectionId } });
  if (!col || col.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const { routeId } = await req.json();
    if (!routeId) return NextResponse.json({ error: 'routeId required' }, { status: 400 });

    const route = await prisma.route.findUnique({ where: { id: routeId } });
    if (!route || route.userId !== session.user.id) return NextResponse.json({ error: 'Route not found' }, { status: 404 });

    const updated = await prisma.routeCollection.update({
      where: { id: collectionId },
      data: { routes: { connect: { id: routeId } } },
      include: { routes: { select: { id: true, name: true } } },
    });
    return NextResponse.json(updated);
  } catch (err) {
    logger.error({ err }, 'POST /api/collections/[id]/routes error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/collections/[id]/routes — remove a route from the collection
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: collectionId } = await ctx.params;
  const col = await prisma.routeCollection.findUnique({ where: { id: collectionId } });
  if (!col || col.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const { routeId } = await req.json();
    if (!routeId) return NextResponse.json({ error: 'routeId required' }, { status: 400 });

    const updated = await prisma.routeCollection.update({
      where: { id: collectionId },
      data: { routes: { disconnect: { id: routeId } } },
      include: { routes: { select: { id: true, name: true } } },
    });
    return NextResponse.json(updated);
  } catch (err) {
    logger.error({ err }, 'DELETE /api/collections/[id]/routes error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
