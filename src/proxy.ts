import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
  // Without a secret we can't verify the token — let the request through
  if (!secret) return NextResponse.next();

  const isSecure = request.nextUrl.protocol === 'https:';
  const cookieName = isSecure
    ? '__Secure-authjs.session-token'
    : 'authjs.session-token';

  try {
    const token = await getToken({ req: request, secret, cookieName });
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  } catch {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*'],
};
