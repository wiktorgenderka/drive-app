import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { randomBytes } from 'crypto';
import logger from '@/lib/logger';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await context.params;
    const route = await prisma.route.findUnique({ where: { id } });

    if (!route) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (route.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const token = route.shareToken ?? randomBytes(12).toString('base64url');

    if (!route.shareToken) {
      await prisma.route.update({ where: { id }, data: { shareToken: token } });
    }

    const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    return NextResponse.json({ token, url: appUrl + '/r/' + token });
  } catch (err) {
    logger.error({ err }, 'POST /api/routes/[id]/share-link error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}