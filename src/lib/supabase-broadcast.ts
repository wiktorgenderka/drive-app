/**
 * Server-side HTTP broadcast to Supabase Realtime.
 * Works in serverless/Edge — no WebSocket required.
 */
export async function broadcastToChannel(
  channel: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({
        messages: [{ topic: channel, event, payload }],
      }),
    });
  } catch (err) {
    console.error('[broadcast] error:', err);
  }
}
