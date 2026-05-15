import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const route = await prisma.route.findUnique({ where: { id } });
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }
    if (route.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const token = route.shareToken ?? randomBytes(12).toString('base64url');

    const updated = await prisma.route.update({
      where: { id },
      data: { shareToken: token },
      select: { shareToken: true },
    });

    const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? '';
    return NextResponse.json({ token: updated.shareToken, url: `${baseUrl}/r/${updated.shareToken}` });
  } catch (error) {
    logger.error({ err: error }, 'Share link error:');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const route = await prisma.route.findUnique({ where: { id } });
    if (!route) {
      return NextResponse.json({ error: 'Route not found' }, { status: 404 });
    }
    if (route.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    await prisma.route.update({ where: { id }, data: { shareToken: null } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error({ err: error }, 'Revoke share link error:');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
