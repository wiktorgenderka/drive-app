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
  onStartTrip: () => void;
  onStopTrip: () => void;
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
  onStartTrip,
  onStopTrip,
  onOpenSpeedLimit,
}: TripRecorderUIProps) {
  return (
    <>
      {/* Bottom-left: speed circle + trip record button */}
      {!isNavigating && (
        <div className="absolute bottom-6 left-4 z-10 flex flex-col items-center gap-3">
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

          <button
            onClick={isTripActive ? onStopTrip : onStartTrip}
            className={`flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition ${
              isTripActive
                ? 'bg-red-600 text-white'
                : 'bg-card-bg/90 border border-card-border backdrop-blur-md text-muted hover:text-foreground'
            }`}
            title={isTripActive ? 'Zakończ podróż' : 'Rozpocznij podróż'}
          >
            {isTripActive ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 8 12 12 14 14" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Trip recording bar */}
      {isTripActive && !isNavigating && (
        <div className="absolute top-3 left-3 right-16 z-20">
          <div className="flex items-center gap-2.5 rounded-2xl border border-card-border bg-card-bg/95 px-3 py-2.5 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold text-red-500">REC</span>
            </div>
            <div className="h-4 w-px bg-card-border shrink-0" />
            <span className="font-mono text-sm font-bold text-foreground shrink-0">{fmtTripTime(tripElapsed)}</span>
            <div className="h-4 w-px bg-card-border shrink-0" />
            <span className="text-xs font-semibold text-foreground shrink-0">{fmtDist(tripDistance)}</span>
            {tripMaxSpeed > 0 && (
              <>
                <div className="h-4 w-px bg-card-border shrink-0" />
                <span className="text-xs text-muted shrink-0">
                  max <span className="font-bold text-foreground">{Math.round(tripMaxSpeed)}</span>
                </span>
              </>
            )}
            <button
              onClick={onStopTrip}
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="1.5" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
