import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: reportId } = await context.params;

    const body = await request.json();
    const { isUpvote } = body;

    if (typeof isUpvote !== "boolean") {
      return NextResponse.json(
        { error: "isUpvote must be a boolean" },
        { status: 400 }
      );
    }

    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Check if report has expired
    if (report.expiresAt && new Date() > report.expiresAt) {
      return NextResponse.json(
        { error: "Report has expired" },
        { status: 410 }
      );
    }

    const existingVote = await prisma.reportVote.findUnique({
      where: {
        reportId_userId: {
          reportId,
          userId: session.user.id,
        },
      },
    });

    if (existingVote) {
      if (existingVote.isUpvote === isUpvote) {
        // Same vote direction: remove the vote (toggle off)
        await prisma.reportVote.delete({
          where: { id: existingVote.id },
        });
      } else {
        // Different vote direction: update the vote
        await prisma.reportVote.update({
          where: { id: existingVote.id },
          data: { isUpvote },
        });
      }
    } else {
      // No existing vote: create new one
      await prisma.reportVote.create({
        data: {
          reportId,
          userId: session.user.id,
          isUpvote,
        },
      });
    }

    // Return updated counts + user's current vote
    const allVotes = await prisma.reportVote.findMany({
      where: { reportId },
      select: { isUpvote: true, userId: true },
    });
    const upvotes = allVotes.filter((v) => v.isUpvote).length;
    const downvotes = allVotes.filter((v) => !v.isUpvote).length;
    const myVote = allVotes.find((v) => v.userId === session.user.id);
    const userVote = myVote ? myVote.isUpvote : null;

    // 5 downvotes → delete the report
    if (downvotes >= 5) {
      await prisma.report.delete({ where: { id: reportId } });
      return NextResponse.json({ reportId, upvotes, downvotes, userVote, deleted: true });
    }

    // 5 upvotes → mark as confirmed (resets the "ask again" cycle)
    if (upvotes >= 5) {
      await prisma.report.update({
        where: { id: reportId },
        data: { confirmedAt: new Date() },
      });
    }

    return NextResponse.json({ reportId, upvotes, downvotes, userVote });
  } catch (error) {
    console.error("Vote on report error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
