import { NextResponse } from 'next/server';
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
    console.error('Spotify now playing error:', error);
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
    console.error('Spotify connect error:', error);
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
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        spotifyAccessToken: null,
        spotifyRefreshToken: null,
        spotifyExpiresAt: null,
      },
    });

    return NextResponse.json({ disconnected: true });
  } catch (error) {
    console.error('Spotify disconnect error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
