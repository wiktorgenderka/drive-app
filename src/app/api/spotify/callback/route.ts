import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/spotify';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // userId
    const error = searchParams.get('error');

    if (error || !code || !state) {
      return NextResponse.redirect(new URL('/dashboard?spotify=error', request.url));
    }

    const tokens = await exchangeCode(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.user.update({
      where: { id: state },
      data: {
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token,
        spotifyExpiresAt: expiresAt,
      },
    });

    return NextResponse.redirect(new URL('/dashboard?spotify=connected', request.url));
  } catch (error) {
    console.error('Spotify callback error:', error);
    return NextResponse.redirect(new URL('/dashboard?spotify=error', request.url));
  }
}
