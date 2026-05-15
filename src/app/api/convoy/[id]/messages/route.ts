import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function isMember(convoyId: string, userId: string) {
  const m = await prisma.convoyMember.findUnique({
    where: { convoyId_userId: { convoyId, userId } },
  });
  return !!m;
}

// GET - fetch last 100 messages
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: convoyId } = await params;
  if (!(await isMember(convoyId, session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const messages = await prisma.convoyMessage.findMany({
      where: { convoyId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return NextResponse.json(messages);
  } catch (err) {
    logger.error({ err: err }, '[convoy/messages GET]');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - save new text or voice message
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: convoyId } = await params;
  if (!(await isMember(convoyId, session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ error: 'Unsupported Media Type' }, { status: 415 });

  const body = await req.json();
  const { id, type, message, audioData, mimeType, duration } = body;

  if (!id) return NextResponse.json({ error: 'Brak id' }, { status: 400 });

  if (type === 'voice') {
    if (!audioData) return NextResponse.json({ error: 'Brak audio' }, { status: 400 });
    const msg = await prisma.convoyMessage.create({
      data: {
        id,
        convoyId,
        userId: session.user.id,
        userName: session.user.name ?? 'Nieznany',
        type: 'voice',
        audioData,
        mimeType: mimeType ?? '',
        duration: typeof duration === 'number' ? duration : 0,
      },
    });
    return NextResponse.json(msg, { status: 201 });
  }

  // text (default)
  if (!message?.trim()) return NextResponse.json({ error: 'Brak wiadomości' }, { status: 400 });
  if (message.trim().length > 500) return NextResponse.json({ error: 'Wiadomość za długa (max 500 znaków)' }, { status: 400 });
  const msg = await prisma.convoyMessage.create({
    data: {
      id,
      convoyId,
      userId: session.user.id,
      userName: session.user.name ?? 'Nieznany',
      type: 'text',
      message: message.trim(),
    },
  });
  return NextResponse.json(msg, { status: 201 });
}

// PATCH - edit or soft-delete a message
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: convoyId } = await params;
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) return NextResponse.json({ error: 'Unsupported Media Type' }, { status: 415 });

  const { messageId, action, newText } = await req.json();

  const msg = await prisma.convoyMessage.findUnique({ where: { id: messageId } });
  if (!msg || msg.convoyId !== convoyId || msg.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (action === 'delete') {
    await prisma.convoyMessage.update({ where: { id: messageId }, data: { deleted: true } });
  } else if (action === 'edit' && newText?.trim()) {
    await prisma.convoyMessage.update({
      where: { id: messageId },
      data: { message: newText.trim(), edited: true },
    });
  } else {
    return NextResponse.json({ error: 'Nieprawidłowa akcja' }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
