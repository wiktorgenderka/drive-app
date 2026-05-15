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

    // Users with pending incoming friend requests in the last 24h
    const pendingByUser = await prisma.friendship.groupBy({
      by: ['addresseeId'],
      where: { status: 'PENDING', createdAt: { gte: since } },
    });

    // Recent posts from friends
    const recentPosts = await prisma.post.findMany({
      where: { createdAt: { gte: since } },
      select: { userId: true },
    });
    const recentPosterIds = new Set(recentPosts.map((p) => p.userId));

    // All users to consider
    const userIds = [...new Set(pendingByUser.map((r) => r.addresseeId))];
    if (userIds.length === 0) {
      return NextResponse.json({ sent: 0, errors: 0, timestamp: new Date().toISOString() });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });

    let sent = 0;
    let errors = 0;

    for (const user of users) {
      // Pending friend requests
      const pendingFriendships = await prisma.friendship.findMany({
        where: { addresseeId: user.id, status: 'PENDING', createdAt: { gte: since } },
        select: { requester: { select: { name: true } } },
      });
      const pendingRequests = pendingFriendships.map((f) => f.requester.name ?? 'Użytkownik');

      // Count posts by friends
      const friendIds = await prisma.friendship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ requesterId: user.id }, { addresseeId: user.id }],
        },
        select: { requesterId: true, addresseeId: true },
      });
      const friendUserIds = friendIds.map((f) =>
        f.requesterId === user.id ? f.addresseeId : f.requesterId
      );
      const newPostsCount = friendUserIds.filter((id) => recentPosterIds.has(id)).length;

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
