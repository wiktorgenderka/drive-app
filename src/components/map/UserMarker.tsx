'use client';

import { Marker } from 'react-map-gl/mapbox';

interface UserMarkerProps {
  latitude: number;
  longitude: number;
  heading?: number | null;
  isNavigating?: boolean;
}

export default function UserMarker({ latitude, longitude, heading, isNavigating }: UserMarkerProps) {
  const hasHeading = heading != null && !Number.isNaN(heading);
  const size = isNavigating ? 60 : 48;

  return (
    <Marker
      latitude={latitude}
      longitude={longitude}
      anchor="center"
      pitchAlignment="map"
      rotationAlignment="map"
      rotation={hasHeading ? (heading as number) : 0}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        {/* Outer ping ring */}
        <span
          className="animate-location-ping absolute rounded-full"
          style={{
            width: size * 0.55,
            height: size * 0.55,
            background: 'rgba(249, 115, 22, 0.35)',
          }}
        />
        {/* Second ring — offset timing */}
        <span
          className="animate-location-ping absolute rounded-full"
          style={{
            width: size * 0.55,
            height: size * 0.55,
            background: 'rgba(249, 115, 22, 0.2)',
            animationDelay: '0.6s',
          }}
        />

        {hasHeading ? (
          /* Arrow — direction indicator */
          <svg
            width={isNavigating ? 40 : 32}
            height={isNavigating ? 46 : 36}
            viewBox="0 0 38 42"
            style={{
              filter:
                'drop-shadow(0 0 8px rgba(249,115,22,0.9)) drop-shadow(0 2px 4px rgba(0,0,0,0.7))',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <defs>
              <linearGradient id="arrowFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fed7aa" />
                <stop offset="55%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#ea580c" />
              </linearGradient>
            </defs>
            <path
              d="M19 2 L34 38 L19 30 L4 38 Z"
              fill="url(#arrowFill)"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          /* Dot — no heading */
          <div
            style={{
              width: isNavigating ? 20 : 16,
              height: isNavigating ? 20 : 16,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #fed7aa, #f97316 60%, #ea580c)',
              border: '2.5px solid rgba(255,255,255,0.8)',
              boxShadow:
                '0 0 12px rgba(249,115,22,0.9), 0 0 24px rgba(249,115,22,0.4), 0 2px 6px rgba(0,0,0,0.5)',
              position: 'relative',
              zIndex: 1,
            }}
          />
        )}
      </div>
    </Marker>
  );
}
