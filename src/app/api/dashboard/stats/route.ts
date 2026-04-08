import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalRoutes,
      totalReports,
      todayReports,
      activeConvoy,
      pendingRequests,
      nearbyReportsCount,
    ] = await Promise.all([
      prisma.route.count({ where: { userId: session.user.id } }),
      prisma.report.count({ where: { userId: session.user.id } }),
      prisma.report.count({
        where: { userId: session.user.id, createdAt: { gte: todayStart } },
      }),
      prisma.convoyMember.findFirst({
        where: { userId: session.user.id },
        include: {
          convoy: {
            include: {
              _count: { select: { members: true } },
            },
          },
        },
      }),
      prisma.friendship.count({
        where: { addresseeId: session.user.id, status: "PENDING" },
      }),
      prisma.report.count({
        where: {
          expiresAt: { gte: now },
        },
      }),
    ]);

    return NextResponse.json({
      totalRoutes,
      totalReports,
      todayReports,
      activeConvoy: activeConvoy
        ? {
            id: activeConvoy.convoy.id,
            name: activeConvoy.convoy.name,
            role: activeConvoy.role,
            memberCount: activeConvoy.convoy._count.members,
          }
        : null,
      pendingRequests,
      nearbyReportsCount,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
