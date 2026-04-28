'use client';

import { Source, Layer, Marker } from 'react-map-gl/mapbox';
import type { Route } from '@/stores/useMapStore';
import { useMapStore } from '@/stores/useMapStore';

interface RouteLayerProps {
  route: Route;
}

export default function RouteLayer({ route }: RouteLayerProps) {
  const mysteryDrive = useMapStore((s) => s.mysteryDrive);
  // Podczas aktywnego mystery run MysteryDriveLayer renderuje segmentowaną wersję trasy.
  if (mysteryDrive?.status === 'running' && mysteryDrive.routeId === route.id) return null;

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

  return (
    <>
      <Source id={`route-${route.id}`} type="geojson" data={geojson}>
        {route.isActive ? (
          // NFS Unbound style: neonowa żółta linia z 3-warstwową poświatą.
          <>
            <Layer
              id={`route-glow-${route.id}`}
              type="line"
              paint={{ 'line-color': '#fbbf24', 'line-width': 18, 'line-opacity': 0.18, 'line-blur': 7 }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
            <Layer
              id={`route-casing-${route.id}`}
              type="line"
              paint={{ 'line-color': '#f97316', 'line-width': 9, 'line-opacity': 0.85 }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
            <Layer
              id={`route-line-${route.id}`}
              type="line"
              paint={{ 'line-color': '#fde047', 'line-width': 4, 'line-opacity': 1 }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
          </>
        ) : (
          <Layer
            id={`route-line-${route.id}`}
            type="line"
            paint={{ 'line-color': '#6b7280', 'line-width': 3, 'line-opacity': 0.6 }}
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
          />
        )}
      </Source>

      {waypoints.map((wp, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === waypoints.length - 1;
        // NFS-style: zielony start, czerwona meta, żółto-pomarańczowe pośrednie — wszystkie z poświatą.
        const color = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#fbbf24';
        return (
          <Marker
            key={`${route.id}-wp-${idx}`}
            longitude={wp.longitude}
            latitude={wp.latitude}
            anchor="center"
          >
            <div
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black text-white"
              style={{
                background: color,
                border: '2.5px solid #ffffff',
                boxShadow: `0 0 0 3px ${color}55, 0 0 14px ${color}, 0 2px 4px rgba(0,0,0,0.5)`,
              }}
            >
              {idx + 1}
            </div>
          </Marker>
        );
      })}
    </>
  );
}
