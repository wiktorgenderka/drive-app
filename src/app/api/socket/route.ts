import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      status: "ok",
      message: "Socket endpoint is healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Socket health check error:", error);
    return NextResponse.json(
      { status: "error", message: "Socket endpoint unavailable" },
      { status: 503 }
    );
  }
}
