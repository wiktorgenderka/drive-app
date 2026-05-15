import { NextResponse } from "next/server";
import logger from '@/lib/logger';

export async function GET() {
  try {
    return NextResponse.json({
      status: "ok",
      message: "Socket endpoint is healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "Socket health check error:");
    return NextResponse.json(
      { status: "error", message: "Socket endpoint unavailable" },
      { status: 503 }
    );
  }
}
