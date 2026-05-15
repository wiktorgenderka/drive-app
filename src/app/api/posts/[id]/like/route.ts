import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { awardXP } from "@/lib/xp";
import { checkAndUnlockAchievements } from "@/lib/achievements";

type RouteContext = { params: Promise<{ id: string }> };

// Toggle like — POST tworzy/usuwa lajka i zwraca nowy stan + licznik.
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: postId } = await context.params;

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, userId: true } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId: session.user.id } },
    });

    let liked: boolean;
    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
      liked = false;
    } else {
      await prisma.postLike.create({ data: { postId, userId: session.user.id } });
      liked = true;
    }

    const likeCount = await prisma.postLike.count({ where: { postId } });
    await prisma.post.update({ where: { id: postId }, data: { likeCount } });

    if (liked && session.user.id !== post.userId) {
      try {
        await awardXP(session.user.id, 'POST_LIKED');
        if (likeCount >= 10) {
          await checkAndUnlockAchievements(post.userId, { postLikes: likeCount });
        }
      } catch (e) {
        logger.error({ err: e }, 'Like XP error:');
      }
    }

    return NextResponse.json({ liked, likeCount });
  } catch (error) {
    logger.error({ err: error }, "Toggle like error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
