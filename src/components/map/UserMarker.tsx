'use client';

import { Marker } from 'react-map-gl/mapbox';

interface UserMarkerProps {
  latitude: number;
  longitude: number;
  heading?: number | null;
  isNavigating?: boolean;
}

export default function UserMarker({ latitude, longitude, heading, isNavigating }: UserMarkerProps) {
  // Spójny styl NFS Unbound — żółty świecący arrow zarówno podczas nawigacji,
  // jak i poza nią. Bez heading (gdy stoisz / GPS nie zna kierunku) wyświetlamy
  // świecącą żółtą kropkę zamiast obróconego trójkąta.
  const hasHeading = heading != null && !Number.isNaN(heading);
  const size = isNavigating ? 56 : 44;
  const arrowSize = isNavigating ? 38 : 30;
  const arrowH = isNavigating ? 42 : 34;

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
        {/* Pulsujący halo */}
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: 'radial-gradient(closest-side, rgba(253,224,71,0.55), transparent 70%)',
            animation: 'nfs-pulse 1.6s ease-in-out infinite',
          }}
        />
        {hasHeading ? (
          /* Trójkąt — żółty NFS arrow */
          <svg
            width={arrowSize}
            height={arrowH}
            viewBox="0 0 38 42"
            style={{ filter: 'drop-shadow(0 0 6px #facc15) drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}
          >
            <defs>
              <linearGradient id="nfsArrowFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="60%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <path
              d="M19 2 L34 38 L19 30 L4 38 Z"
              fill="url(#nfsArrowFill)"
              stroke="#fff8d6"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          /* Brak heading — świecąca żółta kropka */
          <div
            className="rounded-full"
            style={{
              width: isNavigating ? 22 : 16,
              height: isNavigating ? 22 : 16,
              background: 'radial-gradient(circle at 35% 30%, #fef9c3, #facc15 60%, #f59e0b)',
              border: '2.5px solid #fff8d6',
              boxShadow: '0 0 10px #facc15, 0 0 18px rgba(250,204,21,0.6), 0 2px 4px rgba(0,0,0,0.5)',
            }}
          />
        )}
        <style jsx>{`
          @keyframes nfs-pulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.4); opacity: 0; }
          }
        `}</style>
      </div>
    </Marker>
  );
}
