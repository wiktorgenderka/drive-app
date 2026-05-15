import { NextRequest, NextResponse } from "next/server";
import logger from '@/lib/logger';
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { awardXP, touchStreak } from "@/lib/xp";
import { checkAndUnlockAchievements } from "@/lib/achievements";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const convoy = await prisma.convoy.findUnique({
      where: { id },
      include: {
        members: { where: { userId: session.user.id } },
      },
    });

    if (!convoy) {
      return NextResponse.json(
        { error: "Convoy not found" },
        { status: 404 }
      );
    }

    if (convoy.members.length > 0) {
      return NextResponse.json(
        { error: "Already a member of this convoy" },
        { status: 409 }
      );
    }

    const member = await prisma.convoyMember.create({
      data: {
        convoyId: id,
        userId: session.user.id,
        role: "MEMBER",
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
        convoy: { select: { id: true, name: true } },
      },
    });

    try {
      const userId = session.user.id;
      const { streak } = await touchStreak(userId);
      await awardXP(userId, 'CONVOY_JOINED');
      const convoyCount = await prisma.convoyMember.count({ where: { userId } });
      await checkAndUnlockAchievements(userId, { convoyCount, streak });
    } catch (e) {
      logger.error({ err: e }, 'Convoy XP error:');
    }

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Join convoy error:");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
