'use client';

import { Marker } from 'react-map-gl/mapbox';
import { useMapStore } from '@/stores/useMapStore';

// Renderuje TYLKO bieżący checkpoint + N najbliższych następnych.
// Bieżący jest największy/jaskrawy, kolejne stopniowo blakną — efekt "Need for Speed".
export default function MysteryDriveLayer() {
  const mystery = useMapStore((s) => s.mysteryDrive);
  if (!mystery || mystery.status !== 'running') return null;

  const { waypoints, currentIdx, visibleAhead } = mystery;
  const lastIdx = Math.min(waypoints.length - 1, currentIdx + visibleAhead);
  const visible = waypoints.slice(currentIdx, lastIdx + 1);

  return (
    <>
      {visible.map((wp, i) => {
        const idx = currentIdx + i;
        const isCurrent = i === 0;
        const isFinal = idx === waypoints.length - 1;
        // Im dalej w sekwencji, tym mniejszy i bardziej przezroczysty marker.
        const opacity = isCurrent ? 1 : Math.max(0.35, 1 - i * 0.22);
        const scale = isCurrent ? 1 : Math.max(0.55, 1 - i * 0.15);
        const color = isFinal ? '#10b981' : isCurrent ? '#f97316' : '#fb923c';

        return (
          <Marker
            key={`mystery-${idx}`}
            longitude={wp.longitude}
            latitude={wp.latitude}
            anchor="center"
          >
            <div
              className="relative"
              style={{ opacity, transform: `scale(${scale})` }}
            >
              {/* Pulsujący cień pod aktualnym checkpointem */}
              {isCurrent && (
                <span
                  className="absolute -inset-3 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${color}66 0%, transparent 70%)`,
                    animation: 'pulse-mystery 1.4s ease-in-out infinite',
                  }}
                />
              )}
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-black text-white shadow-2xl ring-4 ring-white/30"
                style={{ background: color }}
              >
                {isFinal ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5 5h6v4h-6zM11 9h6v4h-6zM5 13h6v4h-6zM11 17h6v4h-6z" />
                    <path d="M5 5v18" stroke="currentColor" strokeWidth={1.5} fill="none" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
            </div>
          </Marker>
        );
      })}
      <style jsx global>{`
        @keyframes pulse-mystery {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </>
  );
}
