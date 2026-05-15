import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/collections — list user's collections with route count
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const collections = await prisma.routeCollection.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        routes: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(collections);
  } catch (err) {
    logger.error({ err }, 'GET /api/collections error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/collections — create a collection
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ error: 'Unsupported Media Type' }, { status: 415 });

  try {
    const { name, description, isPublic } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Nazwa jest wymagana' }, { status: 400 });
    if (name.trim().length > 100) return NextResponse.json({ error: 'Nazwa max 100 znaków' }, { status: 400 });

    const collection = await prisma.routeCollection.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isPublic: Boolean(isPublic),
        userId: session.user.id,
      },
      include: { routes: { select: { id: true, name: true } } },
    });
    return NextResponse.json(collection, { status: 201 });
  } catch (err) {
    logger.error({ err }, 'POST /api/collections error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
