import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

interface SuggestedRoute {
  id: string;
  name: string;
  description: string;
  distance: number; // km
  duration: number; // minutes
  type: "scenic" | "mountain" | "coastal" | "city" | "countryside";
  waypoints: { latitude: number; longitude: number; label?: string }[];
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Generate offset points around a center to create interesting loop/out-and-back routes
function generateRoutePoints(
  lat: number,
  lng: number,
  radiusKm: number,
  angleOffset: number
): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  const kmToDeg = 1 / 111.32;

  // Start point
  points.push({ latitude: lat, longitude: lng });

  // Generate 2-3 intermediate waypoints forming a loop
  const numPoints = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < numPoints; i++) {
    const angle = angleOffset + (i * (360 / numPoints)) * (Math.PI / 180);
    const dist = radiusKm * (0.6 + Math.random() * 0.4);
    const dlat = dist * Math.cos(angle) * kmToDeg;
    const dlng =
      (dist * Math.sin(angle) * kmToDeg) / Math.cos(lat * (Math.PI / 180));
    points.push({ latitude: lat + dlat, longitude: lng + dlng });
  }

  // Return to start for a loop
  points.push({ latitude: lat, longitude: lng });

  return points;
}

async function fetchRouteFromMapbox(
  waypoints: { latitude: number; longitude: number }[]
): Promise<{ distance: number; duration: number } | null> {
  if (!MAPBOX_TOKEN || waypoints.length < 2) return null;

  const coords = waypoints
    .map((wp) => `${wp.longitude},${wp.latitude}`)
    .join(";");

  try {
    const res = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?overview=false&access_token=${MAPBOX_TOKEN}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return null;
    const data = await res.json();

    if (!data.routes || data.routes.length === 0) return null;

    return {
      distance: Math.round(data.routes[0].distance / 100) / 10, // km, 1 decimal
      duration: Math.round(data.routes[0].duration / 60), // minutes
    };
  } catch {
    return null;
  }
}

const ROUTE_TEMPLATES = [
  {
    type: "scenic" as const,
    nameTemplates: [
      "Widokowa pętla",
      "Trasa panoramiczna",
      "Malownicza trasa",
    ],
    descriptions: [
      "Piękna trasa z widokami na okolicę",
      "Przyjemna jazda przez malownicze tereny",
      "Idealna na popołudniową przejażdżkę",
    ],
    radiusKm: 7,
  },
  {
    type: "countryside" as const,
    nameTemplates: [
      "Wiejska przejażdżka",
      "Przez pola i lasy",
      "Spokojne drogi",
    ],
    descriptions: [
      "Relaksująca jazda przez wiejskie tereny",
      "Droga przez pola, łąki i małe wioski",
      "Ucieczka od miejskiego zgiełku",
    ],
    radiusKm: 10,
  },
  {
    type: "mountain" as const,
    nameTemplates: [
      "Górska serpentyna",
      "Podgórska trasa",
      "Droga przez wzgórza",
    ],
    descriptions: [
      "Kręta trasa przez pagórkowaty teren",
      "Podróż przez wzniesienia z pięknymi widokami",
      "Wymagająca ale satysfakcjonująca trasa",
    ],
    radiusKm: 8,
  },
  {
    type: "city" as const,
    nameTemplates: [
      "Miejska eksploracja",
      "Tour po okolicy",
      "Odkryj okolice",
    ],
    descriptions: [
      "Przejażdżka po ciekawych zakątkach miasta",
      "Poznaj okolicę z innej perspektywy",
      "Krótka trasa idealna na weekendowy wypad",
    ],
    radiusKm: 4,
  },
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get("lat") ?? "");
    const lng = parseFloat(searchParams.get("lng") ?? "");

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: "lat and lng query params are required" },
        { status: 400 }
      );
    }

    const suggested: SuggestedRoute[] = [];

    // Generate routes from each template
    const routePromises = ROUTE_TEMPLATES.map(async (template, idx) => {
      const nameIdx = Math.floor(Math.random() * template.nameTemplates.length);
      const descIdx = Math.floor(Math.random() * template.descriptions.length);
      const angleOffset = (idx * Math.PI) / 2 + Math.random() * 0.5;

      const waypoints = generateRoutePoints(
        lat,
        lng,
        template.radiusKm,
        angleOffset
      );

      const routeInfo = await fetchRouteFromMapbox(waypoints);

      return {
        id: `suggested-${idx}-${Date.now()}`,
        name: template.nameTemplates[nameIdx],
        description: template.descriptions[descIdx],
        distance: routeInfo?.distance ?? template.radiusKm * 2,
        duration: routeInfo?.duration ?? Math.round(template.radiusKm * 2),
        type: template.type,
        waypoints: waypoints.map((wp) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
        })),
      };
    });

    const results = await Promise.all(routePromises);
    suggested.push(...results);

    return NextResponse.json(suggested);
  } catch (error) {
    console.error("Suggested routes error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
