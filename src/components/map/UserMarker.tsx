'use client';

import { Marker } from 'react-map-gl/mapbox';

interface UserMarkerProps {
  latitude: number;
  longitude: number;
  heading?: number | null;
  isNavigating?: boolean;
}

export default function UserMarker({ latitude, longitude, heading, isNavigating }: UserMarkerProps) {
  if (isNavigating) {
    return (
      <Marker
        latitude={latitude}
        longitude={longitude}
        anchor="center"
        pitchAlignment="map"
        rotationAlignment="map"
        rotation={heading ?? 0}
      >
        {/* Arrow in circle, flat on the map plane — tilts with pitch, rotates with bearing */}
        <div
          className="flex items-center justify-center rounded-full border-[3px] border-white"
          style={{
            width: 40,
            height: 40,
            background: '#2563eb',
            boxShadow: '0 0 0 4px rgba(37,99,235,0.35), 0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          {/* Triangle pointing up (north) — Marker rotation aligns it to heading */}
          <svg width="18" height="20" viewBox="0 0 18 20" fill="white">
            <path d="M9 1 L2 18 L9 14.5 L16 18 Z" />
          </svg>
        </div>
      </Marker>
    );
  }

  return (
    <Marker latitude={latitude} longitude={longitude} anchor="center">
      <div className="relative">
        {/* Pulsing ring */}
        <div className="absolute -inset-3 bg-blue-500/20 rounded-full animate-ping" />
        <div className="absolute -inset-2 bg-blue-500/30 rounded-full animate-pulse" />
        {/* Center dot */}
        <div className="relative w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
      </div>
    </Marker>
  );
}
