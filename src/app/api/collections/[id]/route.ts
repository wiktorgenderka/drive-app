import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/collections/[id] — update name/description/isPublic
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const col = await prisma.routeCollection.findUnique({ where: { id } });
  if (!col || col.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ error: 'Unsupported Media Type' }, { status: 415 });

  try {
    const { name, description, isPublic } = await req.json();
    const updated = await prisma.routeCollection.update({
      where: { id },
      data: {
        ...(name?.trim() && { name: name.trim() }),
        description: description !== undefined ? (description?.trim() || null) : undefined,
        ...(isPublic !== undefined && { isPublic: Boolean(isPublic) }),
      },
      include: { routes: { select: { id: true, name: true } } },
    });
    return NextResponse.json(updated);
  } catch (err) {
    logger.error({ err }, 'PATCH /api/collections/[id] error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/collections/[id] — delete a collection
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const col = await prisma.routeCollection.findUnique({ where: { id } });
  if (!col || col.userId !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    await prisma.routeCollection.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'DELETE /api/collections/[id] error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
