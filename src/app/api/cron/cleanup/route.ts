import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/cron/cleanup
 *
 * Deletes expired reports from the database.
 * Should be called by a cron job (e.g. Vercel Cron or an external scheduler)
 * at a regular interval (e.g. every 15 minutes).
 *
 * Protect this endpoint by setting CRON_SECRET in environment variables
 * and sending it as the Authorization header:
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.report.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    return NextResponse.json({
      deleted: result.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron cleanup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
