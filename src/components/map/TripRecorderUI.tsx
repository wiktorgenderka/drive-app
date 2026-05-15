'use client';

import { fmtDist, fmtTripTime } from '@/lib/mapNavigation';

interface TripRecorderUIProps {
  isNavigating: boolean;
  isTripActive: boolean;
  tripElapsed: number;
  tripDistance: number;
  tripMaxSpeed: number;
  speedKmh: number;
  speedColor: string | undefined;
  speedLimit: number | null;
  onOpenSpeedLimit: () => void;
}

export default function TripRecorderUI({
  isNavigating,
  isTripActive,
  tripElapsed,
  tripDistance,
  tripMaxSpeed,
  speedKmh,
  speedColor,
  speedLimit,
  onOpenSpeedLimit,
}: TripRecorderUIProps) {
  return (
    <>
      {/* Speed circle — bottom left */}
      {!isNavigating && (
        <div className="absolute bottom-6 left-4 z-10">
          <button
            onClick={onOpenSpeedLimit}
            className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-card-bg/90 border-2 shadow-lg backdrop-blur-md transition"
            style={{ borderColor: speedColor ?? 'var(--card-border)' }}
            title="Ustaw limit prędkości"
          >
            <span className="text-lg font-bold leading-none" style={{ color: speedColor ?? 'var(--foreground)' }}>
              {speedKmh}
            </span>
            <span className="text-[10px] font-medium text-muted">km/h</span>
            {speedLimit && (
              <span className="text-[8px] text-muted leading-none">/{speedLimit}</span>
            )}
          </button>
        </div>
      )}

      {/* Auto-trip info bar — top (no manual stop button) */}
      {isTripActive && !isNavigating && (
        <div className="absolute top-3 left-3 right-16 z-20">
          <div className="flex items-center gap-2.5 rounded-2xl border border-card-border bg-card-bg/95 px-3 py-2.5 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-500">AUTO</span>
            </div>
            <div className="h-4 w-px bg-card-border shrink-0" />
            <span className="font-mono text-sm font-bold text-foreground shrink-0">{fmtTripTime(tripElapsed)}</span>
            <div className="h-4 w-px bg-card-border shrink-0" />
            <span className="text-xs font-semibold text-foreground shrink-0">{fmtDist(tripDistance)}</span>
            {tripMaxSpeed > 0 && (
              <>
                <div className="h-4 w-px bg-card-border shrink-0" />
                <span className="text-xs text-muted shrink-0">
                  max <span className="font-bold text-foreground">{Math.round(tripMaxSpeed)}</span> km/h
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
