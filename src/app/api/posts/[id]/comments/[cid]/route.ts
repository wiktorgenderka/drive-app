import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; cid: string }> };

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: postId, cid } = await context.params;

    const comment = await prisma.postComment.findUnique({ where: { id: cid } });
    if (!comment || comment.postId !== postId) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    if (comment.userId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    await prisma.postComment.delete({ where: { id: cid } });
    const commentCount = await prisma.postComment.count({ where: { postId } });
    await prisma.post.update({ where: { id: postId }, data: { commentCount } });

    return NextResponse.json({ commentCount });
  } catch (error) {
    console.error("Delete comment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
