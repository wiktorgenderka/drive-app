import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getValidAccessToken, fetchNowPlaying } from "@/lib/spotify";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { requesterId: session.user.id, status: "ACCEPTED" },
          { addresseeId: session.user.id, status: "ACCEPTED" },
        ],
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            latitude: true,
            longitude: true,
            lastLocationUpdate: true,
            spotifyRefreshToken: true,
          },
        },
        addressee: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            latitude: true,
            longitude: true,
            lastLocationUpdate: true,
            spotifyRefreshToken: true,
          },
        },
      },
    });

    // Consider "online" if location was updated in the last 10 minutes
    const onlineThreshold = new Date(Date.now() - 10 * 60 * 1000);

    const friendsBase = friendships.map((f) => {
      const friend =
        f.requesterId === session.user!.id ? f.addressee : f.requester;
      const isOnline =
        friend.lastLocationUpdate != null &&
        friend.lastLocationUpdate >= onlineThreshold;
      const isDriving =
        isOnline && friend.latitude != null && friend.longitude != null;

      return {
        id: friend.id,
        name: friend.name,
        email: friend.email,
        image: friend.image,
        isOnline,
        isDriving,
        latitude: isOnline ? friend.latitude : null,
        longitude: isOnline ? friend.longitude : null,
        hasSpotify: !!friend.spotifyRefreshToken,
      };
    });

    // Fetch Spotify now-playing for online friends with Spotify connected (in parallel)
    const friends = await Promise.all(
      friendsBase.map(async (friend) => {
        if (!friend.hasSpotify) {
          return { ...friend, spotify: null };
        }
        try {
          const token = await getValidAccessToken(friend.id);
          if (!token) return { ...friend, spotify: null };
          const nowPlaying = await fetchNowPlaying(token);
          return { ...friend, spotify: nowPlaying };
        } catch {
          return { ...friend, spotify: null };
        }
      })
    );

    // Sort: online first, then by name
    friends.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(friends);
  } catch (error) {
    console.error("Get online friends error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
