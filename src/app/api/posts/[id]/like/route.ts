import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// Toggle like — POST tworzy/usuwa lajka i zwraca nowy stan + licznik.
export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: postId } = await context.params;

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
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

    return NextResponse.json({ liked, likeCount });
  } catch (error) {
    console.error("Toggle like error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
