'use client';

import { Source, Layer, Marker } from 'react-map-gl/mapbox';
import type { Route } from '@/stores/useMapStore';

interface RouteLayerProps {
  route: Route;
}

export default function RouteLayer({ route }: RouteLayerProps) {
  if (!route.coordinates || route.coordinates.length < 2) return null;

  const geojson: GeoJSON.Feature = {
    type: 'Feature',
    properties: { name: route.name },
    geometry: {
      type: 'LineString',
      coordinates: route.coordinates,
    },
  };

  const waypoints = route.waypoints ?? [];
  const color = route.isActive ? '#3b82f6' : '#6b7280';

  return (
    <>
      <Source id={`route-${route.id}`} type="geojson" data={geojson}>
        <Layer
          id={`route-line-${route.id}`}
          type="line"
          paint={{
            'line-color': color,
            'line-width': route.isActive ? 5 : 3,
            'line-opacity': 0.8,
          }}
          layout={{
            'line-join': 'round',
            'line-cap': 'round',
          }}
        />
      </Source>

      {waypoints.map((wp, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === waypoints.length - 1;
        const bgColor = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#f97316';

        return (
          <Marker
            key={`${route.id}-wp-${idx}`}
            longitude={wp.longitude}
            latitude={wp.latitude}
            anchor="center"
          >
            <div
              style={{ backgroundColor: bgColor }}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-lg"
            >
              {idx + 1}
            </div>
          </Marker>
        );
      })}
    </>
  );
}
