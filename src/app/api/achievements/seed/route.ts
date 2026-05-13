import { NextResponse } from 'next/server';
import { seedAchievements } from '@/lib/achievements';

// One-time seed endpoint — call once after deploy
export async function POST(req: Request) {
  const secret = req.headers.get('x-seed-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  await seedAchievements();
  return NextResponse.json({ ok: true });
}
