import prisma from './prisma';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/api/spotify/callback';

const SCOPES = 'user-read-currently-playing user-read-playback-state';

export function getSpotifyAuthUrl(state: string) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
    }),
  });

  if (!res.ok) throw new Error('Spotify token exchange failed');
  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }>;
}

async function refreshAccessToken(userId: string, refreshToken: string) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    // Token revoked — clear from DB
    await prisma.user.update({
      where: { id: userId },
      data: { spotifyAccessToken: null, spotifyRefreshToken: null, spotifyExpiresAt: null },
    });
    return null;
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      spotifyAccessToken: data.access_token,
      spotifyRefreshToken: data.refresh_token ?? refreshToken,
      spotifyExpiresAt: expiresAt,
    },
  });

  return data.access_token as string;
}

export async function getValidAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { spotifyAccessToken: true, spotifyRefreshToken: true, spotifyExpiresAt: true },
  });

  if (!user?.spotifyRefreshToken) return null;

  // If token is still valid (with 60s buffer)
  if (user.spotifyAccessToken && user.spotifyExpiresAt && user.spotifyExpiresAt > new Date(Date.now() + 60_000)) {
    return user.spotifyAccessToken;
  }

  return refreshAccessToken(userId, user.spotifyRefreshToken);
}

export interface NowPlaying {
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  trackUrl: string;
  progressMs: number;
  durationMs: number;
}

export async function fetchNowPlaying(accessToken: string): Promise<NowPlaying | null> {
  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 204 = no track playing
  if (res.status === 204 || !res.ok) return null;

  const data = await res.json();
  if (!data.item) return null;

  return {
    isPlaying: data.is_playing,
    title: data.item.name,
    artist: data.item.artists.map((a: { name: string }) => a.name).join(', '),
    album: data.item.album.name,
    albumArt: data.item.album.images?.[0]?.url ?? '',
    trackUrl: data.item.external_urls?.spotify ?? '',
    progressMs: data.progress_ms ?? 0,
    durationMs: data.item.duration_ms ?? 0,
  };
}
