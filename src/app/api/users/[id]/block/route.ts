import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/users/[id]/block — check if current user has blocked this user
export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: blockedId } = await ctx.params;
  const block = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId } },
  });
  return NextResponse.json({ blocked: !!block });
}

// POST /api/users/[id]/block — block a user
export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: blockedId } = await ctx.params;
  if (blockedId === session.user.id) {
    return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
  }

  try {
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: session.user.id, blockedId } },
      update: {},
      create: { blockerId: session.user.id, blockedId },
    });
    // Also remove any friendship between the two users
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: session.user.id, addresseeId: blockedId },
          { requesterId: blockedId, addresseeId: session.user.id },
        ],
      },
    });
    return NextResponse.json({ blocked: true });
  } catch (err) {
    logger.error({ err }, 'POST /api/users/[id]/block error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/users/[id]/block — unblock a user
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: blockedId } = await ctx.params;

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
