import { handlers } from '@/lib/auth';
import type { NextRequest } from 'next/server';

/**
 * Wrap NextAuth handlers in try-catch so that any unexpected error
 * returns JSON instead of Next.js HTML error page — which would cause
 * ClientFetchError: "Unexpected token '<'" in the browser.
 */
async function safeGET(req: NextRequest) {
  try {
    return await handlers.GET(req);
  } catch (error) {
    console.error('[auth] GET handler error:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function safePOST(req: NextRequest) {
  try {
    return await handlers.POST(req);
  } catch (error) {
    console.error('[auth] POST handler error:', error);
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export { safeGET as GET, safePOST as POST };
