import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface MapboxFeature {
  type: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: {
    mapbox_id?: string;
    name?: string;
    full_address?: string;
    address?: string;
    brand?: string;
    brand_id?: string;
    [key: string]: unknown;
  };
}

async function fetchMapboxStations(lat: number, lng: number, radius: number) {
  if (!MAPBOX_TOKEN) return [];

  // Mapbox Search Box API – category search for gas stations
  // radius param is in km, max 10
  const radiusKm = Math.min(radius, 10);
  const url =
    `https://api.mapbox.com/search/searchbox/v1/category/gas_station` +
    `?proximity=${lng},${lat}` +
    `&radius=${radiusKm}` +
    `&limit=10` +
    `&language=pl` +
    `&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return [];

  const data = await res.json();
  const features: MapboxFeature[] = data.features ?? [];

  return features.map((f) => {
    const [fLng, fLat] = f.geometry.coordinates;
    const p = f.properties;
    return {
      id: p.mapbox_id ?? `mbx-${fLng}-${fLat}`,
      name: p.name ?? "Stacja paliw",
      brand: p.brand ?? undefined,
      address: p.full_address ?? p.address ?? undefined,
      latitude: fLat,
      longitude: fLng,
      prices: [],
      lastUpdated: Date.now(),
      isMapbox: true,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lng = parseFloat(searchParams.get("lng") || "");
    const radius = parseFloat(searchParams.get("radius") || "10");

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: "lat and lng query parameters are required" },
        { status: 400 }
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude values" },
        { status: 400 }
      );
    }

    // Fetch from Mapbox and database in parallel
    const [mapboxStations, dbStations] = await Promise.all([
      fetchMapboxStations(lat, lng, radius),
      (async () => {
        const latDelta = radius / 111.32;
        const lngDelta = radius / (111.32 * Math.cos((lat * Math.PI) / 180));
        const stations = await prisma.fuelStation.findMany({
          where: {
            latitude: { gte: lat - latDelta, lte: lat + latDelta },
            longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
          },
          include: {
            prices: {
              orderBy: { updatedAt: "desc" },
              take: 5,
              include: { user: { select: { id: true, name: true } } },
            },
          },
        });
        return stations.map((s) => ({
          id: s.id,
          name: s.name,
          brand: s.brand ?? undefined,
          address: s.address ?? undefined,
          latitude: s.latitude,
          longitude: s.longitude,
          prices: s.prices,
          lastUpdated: Date.now(),
          isMapbox: false,
        }));
      })(),
    ]);

    // Merge: DB stations override Mapbox ones (have price data)
    // Match by proximity (within 100m) to avoid duplicates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merged: any[] = [...mapboxStations];
    for (const db of dbStations) {
      const duplicate = merged.findIndex((m) => {
        const dLat = (m.latitude - db.latitude) * 111320;
        const dLng =
          (m.longitude - db.longitude) *
          111320 *
          Math.cos((db.latitude * Math.PI) / 180);
        return Math.sqrt(dLat * dLat + dLng * dLng) < 100;
      });
      if (duplicate >= 0) {
        merged[duplicate] = db; // replace with DB version (has prices)
      } else {
        merged.push(db);
      }
    }

    return NextResponse.json(merged);
  } catch (error) {
    console.error("Get fuel stations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, latitude, longitude, address, brand } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Station name is required" },
        { status: 400 }
      );
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json(
        { error: "Valid latitude and longitude are required" },
        { status: 400 }
      );
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude values" },
        { status: 400 }
      );
    }

    // Find existing station within 100m to avoid duplicates
    const latDelta = 0.001; // ~111m
    const lngDelta = 0.001;
    const nearby = await prisma.fuelStation.findFirst({
      where: {
        latitude: { gte: latitude - latDelta, lte: latitude + latDelta },
        longitude: { gte: longitude - lngDelta, lte: longitude + lngDelta },
      },
    });

    if (nearby) {
      return NextResponse.json(nearby, { status: 200 });
    }

    const station = await prisma.fuelStation.create({
      data: {
        name: name.trim(),
        latitude,
        longitude,
        address: address || null,
        brand: brand || null,
      },
    });

    return NextResponse.json(station, { status: 201 });
  } catch (error) {
    console.error("Create fuel station error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
