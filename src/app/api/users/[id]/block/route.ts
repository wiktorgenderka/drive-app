import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import logger from '@/lib/logger';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: blockedId } = await context.params;
  const block = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId } },
  });

  return NextResponse.json({ blocked: !!block });
}

export async function POST(_req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: blockedId } = await context.params;
  if (blockedId === session.user.id) {
    return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
  }

  try {
    await prisma.$transaction([
      prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId: session.user.id, blockedId } },
        create: { blockerId: session.user.id, blockedId },
        update: {},
      }),
      // Remove any existing friendship
      prisma.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: session.user.id, addresseeId: blockedId },
            { requesterId: blockedId, addresseeId: session.user.id },
          ],
        },
      }),
    ]);

    return NextResponse.json({ blocked: true });
  } catch (err) {
    logger.error({ err }, 'POST /api/users/[id]/block error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: blockedId } = await context.params;

  try {
    await prisma.block.deleteMany({
      where: { blockerId: session.user.id, blockedId },
    });
    return NextResponse.json({ blocked: false });
  } catch (err) {
    logger.error({ err }, 'DELETE /api/users/[id]/block error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}