import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { auth } from '@/lib/auth';
import { getSpotifyAuthUrl, getValidAccessToken, fetchNowPlaying } from '@/lib/spotify';

// GET /api/spotify — get now playing for current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = await getValidAccessToken(session.user.id);
    if (!token) {
      return NextResponse.json({ connected: false });
    }

    const nowPlaying = await fetchNowPlaying(token);
    return NextResponse.json({ connected: true, nowPlaying });
  } catch (error) {
    logger.error({ err: error }, 'Spotify now playing error:');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/spotify — initiate Spotify connect (returns auth URL)
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = getSpotifyAuthUrl(session.user.id);
    return NextResponse.json({ url });
  } catch (error) {
    logger.error({ err: error }, 'Spotify connect error:');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/spotify — disconnect Spotify
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const prisma = (await import('@/lib/prisma')).default;
    await prisma.spotifyToken.delete({ where: { userId: session.user.id } }).catch(() => null);

    return NextResponse.json({ disconnected: true });
  } catch (error) {
    logger.error({ err: error }, 'Spotify disconnect error:');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
