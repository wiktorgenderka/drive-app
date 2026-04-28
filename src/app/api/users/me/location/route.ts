import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { broadcastToChannel } from "@/lib/supabase-broadcast";
import { z } from "zod";

const LocationPingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).max(100).nullable().optional(),
  share: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "127.0.0.1";
  if (!rateLimit(`loc:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = LocationPingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { latitude, longitude, speed, share } = parsed.data;
    const me = session.user.id;

    const updatedUser = await prisma.user.update({
      where: { id: me },
      data: { latitude, longitude, speed: speed ?? null, lastLocationUpdate: new Date() },
      select: { name: true, image: true },
    });

    if (share) {
      const friendships = await prisma.friendship.findMany({
        where: {
          status: "ACCEPTED",
          OR: [{ requesterId: me }, { addresseeId: me }],
        },
        select: { requesterId: true, addresseeId: true },
      });
      const friendIds = friendships.map((f) =>
        f.requesterId === me ? f.addresseeId : f.requesterId
      );
      const payload = {
        userId: me,
        name: updatedUser.name,
        image: updatedUser.image,
        latitude,
        longitude,
        speed: speed ?? null,
      };
      await Promise.all(
        friendIds.map((friendId) =>
          broadcastToChannel(`user:${friendId}`, 'friend-location-update', payload)
        )
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Location ping error:", error);
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
