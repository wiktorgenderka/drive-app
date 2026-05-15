import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
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

    await prisma.spotifyToken.upsert({
      where: { userId: state },
      create: {
        userId: state,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      },
    });

    return NextResponse.redirect(new URL('/dashboard?spotify=connected', request.url));
  } catch (error) {
    logger.error({ err: error }, 'Spotify callback error:');
    return NextResponse.redirect(new URL('/dashboard?spotify=error', request.url));
  }
}
