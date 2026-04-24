'use client';

import ManeuverIcon from './ManeuverIcon';
import { NavStep, fmtDist, fmtTime, fmtETA } from '@/lib/mapNavigation';
import { haversineMeters } from '@/lib/geo';

interface UserLocationLike {
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
}

interface NavigationHUDProps {
  isNavigating: boolean;
  hasArrived: boolean;
  navDestName: string;
  currentStep: NavStep | undefined;
  nextStep: NavStep | undefined;
  isFollowing: boolean;
  remainingDistance: number;
  remainingDuration: number;
  speedKmh: number;
  userLocation: UserLocationLike | null;
  onSetFollowing: (v: boolean) => void;
  onEndNavigation: () => void;
}

export default function NavigationHUD({
  isNavigating,
  hasArrived,
  navDestName,
  currentStep,
  nextStep,
  isFollowing,
  remainingDistance,
  remainingDuration,
  speedKmh,
  userLocation,
  onSetFollowing,
  onEndNavigation,
}: NavigationHUDProps) {
  if (!isNavigating) return null;

  return (
    <>
      {/* TOP: Instruction card */}
      <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-3">
        {hasArrived ? (
          <div className="flex items-center gap-4 rounded-2xl bg-emerald-500 px-5 py-4 shadow-2xl">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-white">Dotarłeś do celu!</p>
              <p className="text-sm text-white/80 truncate">{navDestName}</p>
            </div>
            <button
              onClick={onEndNavigation}
              className="shrink-0 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30"
            >
              Zakończ
            </button>
          </div>
        ) : currentStep ? (
          <div className="overflow-hidden rounded-2xl shadow-2xl" style={{ background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(12px)' }}>
            <div className="flex items-center gap-4 px-4 py-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: '#3b82f6' }}
              >
                <ManeuverIcon type={currentStep.type} modifier={currentStep.modifier} size={34} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-3xl font-extrabold leading-none text-white">
                  {fmtDist(
                    (() => {
                      if (!userLocation) return currentStep.distance;
                      const d = haversineMeters(
                        userLocation.latitude, userLocation.longitude,
                        currentStep.maneuverLocation[1], currentStep.maneuverLocation[0]
                      );
                      return Math.min(d, currentStep.distance);
                    })()
                  )}
                </div>
                <div className="mt-1 text-sm font-medium text-white/90 truncate">
                  {currentStep.instruction || (currentStep.name ? `Jedź przez ${currentStep.name}` : 'Kontynuuj jazdę')}
                </div>
              </div>
            </div>
            {nextStep && (
              <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <ManeuverIcon type={nextStep.type} modifier={nextStep.modifier} size={16} />
                </div>
                <span className="text-xs text-white/60 truncate">
                  Następnie: {nextStep.instruction || nextStep.name || 'Kontynuuj'}
                </span>
                <span className="ml-auto shrink-0 text-xs text-white/50">{fmtDist(nextStep.distance)}</span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* BOTTOM: ETA bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-6">
        <div
          className="flex items-center gap-4 rounded-2xl px-5 py-4 shadow-2xl"
          style={{ background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(12px)' }}
        >
          <div className="min-w-0">
            <div className="text-2xl font-extrabold leading-none text-white">{fmtETA(remainingDuration)}</div>
            <div className="mt-0.5 text-xs text-white/50">szacowany przyjazd</div>
          </div>

          <div className="h-8 w-px bg-white/15" />

          <div className="min-w-0">
            <div className="text-lg font-bold leading-none text-white">{fmtDist(remainingDistance)}</div>
            <div className="mt-0.5 text-xs text-white/50">{fmtTime(remainingDuration)}</div>
          </div>

          <div className="ml-auto shrink-0 flex items-center gap-2">
            {!isFollowing && (
              <button
                onClick={() => onSetFollowing(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg transition hover:bg-blue-700"
                title="Wróć do trasy"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
              </button>
            )}
            <button
              onClick={onEndNavigation}
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Zakończ
            </button>
          </div>
        </div>
      </div>

      {/* Speed indicator */}
      <div className="absolute bottom-28 left-4 z-30">
        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-white shadow-lg">
          <span className="text-base font-extrabold leading-none text-gray-900">{speedKmh}</span>
          <span className="text-[9px] font-semibold text-gray-500">km/h</span>
        </div>
      </div>
    </>
  );
}
