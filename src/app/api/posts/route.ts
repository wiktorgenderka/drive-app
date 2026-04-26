import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { CreatePostSchema } from "@/lib/schemas";
import { rateLimit } from "@/lib/rateLimit";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const sort = searchParams.get("sort") === "hot" ? "hot" : "new";
    const filter = searchParams.get("filter") === "friends" ? "friends" : "all";

    const me = session.user.id;

    let userFilter: { in: string[] } | undefined;
    if (filter === "friends") {
      const friendships = await prisma.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ requesterId: me }, { addresseeId: me }],
        },
        select: { requesterId: true, addresseeId: true },
      });
      const friendIds = friendships.map((f) => (f.requesterId === me ? f.addresseeId : f.requesterId));
      userFilter = { in: [me, ...friendIds] };
    }

    const where = userFilter ? { userId: userFilter } : {};

    const orderBy: Prisma.PostOrderByWithRelationInput[] =
      sort === "hot"
        ? [{ likeCount: "desc" }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }];

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy,
        take: limit,
        skip: page * limit,
        include: {
          user: { select: { id: true, name: true, image: true, carDisplay: true } },
          likes: { where: { userId: me }, select: { id: true }, take: 1 },
          comments: {
            orderBy: { createdAt: "desc" },
            take: 2,
            include: { user: { select: { id: true, name: true, image: true } } },
          },
        },
      }),
      prisma.post.count({ where }),
    ]);

    const data = posts.map((p) => {
      const { likes, ...rest } = p;
      return { ...rest, myLiked: likes.length > 0 };
    });

    return NextResponse.json({ data, total, page, limit, sort, filter });
  } catch (error) {
    console.error("List posts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? '127.0.0.1';
  if (!rateLimit(`posts:${ip}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many posts. Spróbuj za chwilę.' }, { status: 429 });
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = CreatePostSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { content, imageData, latitude, longitude } = parsed.data;

    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        content: content ?? null,
        imageData: imageData ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      },
      include: {
        user: { select: { id: true, name: true, image: true, carDisplay: true } },
      },
    });

    return NextResponse.json({ ...post, myLiked: false, comments: [] }, { status: 201 });
  } catch (error) {
    console.error("Create post error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
