import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10) || 10));

    if (q.length < 2) {
      return NextResponse.json({ data: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
      },
      orderBy: { name: "asc" },
      take: limit,
      select: { id: true, name: true, image: true, carDisplay: true },
    });

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error("User search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
