import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CreateCommentSchema } from "@/lib/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: postId } = await context.params;

    const comments = await prisma.postComment.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { id: true, name: true, image: true } } },
    });

    return NextResponse.json({ data: comments });
  } catch (error) {
    logger.error({ err: error }, "List comments error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: postId } = await context.params;

    const ct = req.headers.get('content-type') ?? '';
    if (!ct.includes('application/json')) return NextResponse.json({ error: 'Unsupported Media Type' }, { status: 415 });

    const parsed = CreateCommentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const comment = await prisma.postComment.create({
      data: { postId, userId: session.user.id, content: parsed.data.content },
      include: { user: { select: { id: true, name: true, image: true } } },
    });

    const commentCount = await prisma.postComment.count({ where: { postId } });
    await prisma.post.update({ where: { id: postId }, data: { commentCount } });

    return NextResponse.json({ comment, commentCount }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Add comment error:");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
