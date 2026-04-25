import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const q = (searchParams.get("q") ?? "").trim();
    const sort = searchParams.get("sort") === "new" ? "new" : "top";

    const where = {
      isPublic: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.RouteOrderByWithRelationInput[] =
      sort === "new"
        ? [{ publishedAt: "desc" }]
        : [
            { avgRating: { sort: "desc", nulls: "last" } },
            { ratingCount: "desc" },
            { publishedAt: "desc" },
          ];

    const [routes, total] = await Promise.all([
      prisma.route.findMany({
        where,
        orderBy,
        take: limit,
        skip: page * limit,
        include: {
          user: { select: { id: true, name: true, image: true } },
          _count: { select: { times: true, imports: true } },
          ratings: {
            where: { userId: session.user.id },
            select: { stars: true },
            take: 1,
          },
        },
      }),
      prisma.route.count({ where }),
    ]);

    const data = routes.map((r) => {
      const { ratings, ...rest } = r;
      return { ...rest, myStars: ratings?.[0]?.stars ?? null };
    });

    return NextResponse.json({ data, total, page, limit, sort });
  } catch (error) {
    console.error("Public routes list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
