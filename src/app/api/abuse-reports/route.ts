import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const VALID_TYPES = new Set(['post', 'profile', 'report', 'spot']);
const VALID_REASONS = ['spam', 'abuse', 'inappropriate', 'misinformation', 'other'];

export async function POST(req: NextRequest) {
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ error: 'Unsupported Media Type' }, { status: 415 });

  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { targetType, targetId, reason } = await req.json();

    if (!VALID_TYPES.has(targetType)) return NextResponse.json({ error: 'Invalid targetType' }, { status: 400 });
    if (!targetId?.trim()) return NextResponse.json({ error: 'targetId required' }, { status: 400 });
    if (!VALID_REASONS.includes(reason)) return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });

    // Prevent duplicate reports from same user for same target
    const existing = await prisma.abuseReport.findFirst({
      where: { reporterId: session.user.id, targetType, targetId },
    });
    if (existing) return NextResponse.json({ error: 'Already reported' }, { status: 409 });

    await prisma.abuseReport.create({
      data: {
        reporterId: session.user.id,
        targetType,
        targetId: targetId.trim(),
        reason,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    logger.error({ err }, 'POST /api/abuse-reports error');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
