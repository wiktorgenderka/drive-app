import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import prisma from '@/lib/prisma';
import { sendDigestEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find users with pending friend requests or recent friend activity
    const usersWithActivity = await prisma.user.findMany({
      where: {
        email: { not: null },
        OR: [
          // Has pending incoming friend requests
          { friendsAddressee: { some: { status: 'PENDING', updatedAt: { gte: since } } } },
          // A friend posted something in last 24h
          {
            friendsRequester: {
              some: {
                status: 'ACCEPTED',
                addressee: { posts: { some: { createdAt: { gte: since } } } },
              },
            },
          },
          {
            friendsAddressee: {
              some: {
                status: 'ACCEPTED',
                requester: { posts: { some: { createdAt: { gte: since } } } },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        friendsAddressee: {
          where: { status: 'PENDING', updatedAt: { gte: since } },
          select: { requester: { select: { name: true } } },
        },
      },
      take: 100,
    });

    let sent = 0;
    let errors = 0;

    for (const user of usersWithActivity) {
      if (!user.email) continue;

      const pendingRequests = user.friendsAddressee.map((f) => f.requester.name);
      const newPostsCount = await prisma.post.count({
        where: {
          createdAt: { gte: since },
          user: {
            OR: [
              { friendsAddressee: { some: { requesterId: user.id, status: 'ACCEPTED' } } },
              { friendsRequester: { some: { addresseeId: user.id, status: 'ACCEPTED' } } },
            ],
          },
        },
      });

      if (pendingRequests.length === 0 && newPostsCount === 0) continue;

      try {
        await sendDigestEmail({
          to: user.email,
          name: user.name ?? 'Użytkownik',
          pendingRequests,
          newPostsCount,
        });
        sent++;
      } catch (err) {
        logger.error({ err, userId: user.id }, 'Failed to send digest email');
        errors++;
      }
    }

    return NextResponse.json({ sent, errors, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error({ err: error }, 'Cron email-digest error:');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
