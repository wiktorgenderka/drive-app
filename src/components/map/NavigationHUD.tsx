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

// Kolor łuku/akcentu wg prędkości — od cyan przez zielony, żółty, pomarańczowy do czerwonego.
function speedColor(kmh: number): string {
  if (kmh < 50) return '#22d3ee'; // cyan
  if (kmh < 90) return '#84cc16'; // lime
  if (kmh < 130) return '#fbbf24'; // amber
  if (kmh < 170) return '#f97316'; // orange
  return '#ef4444'; // red
}

function SpeedGauge({ kmh, max = 200 }: { kmh: number; max?: number }) {
  const pct = Math.min(1, Math.max(0, kmh / max));
  const r = 38;
  const c = 2 * Math.PI * r;
  const arc = c * 0.78; // 78% pełnego okręgu (otwarte u dołu)
  const filled = arc * pct;
  const color = speedColor(kmh);
  return (
    <div
      className="relative h-24 w-24 rounded-full"
      style={{
        background: 'radial-gradient(circle at center, rgba(0,0,0,0.85), rgba(0,0,0,0.95))',
        boxShadow: `0 0 20px ${color}55, inset 0 0 8px rgba(0,0,0,0.8)`,
      }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-[140deg]">
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
        />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: 'stroke-dasharray 200ms linear, stroke 300ms ease' }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono text-2xl font-black tabular-nums leading-none text-white"
          style={{ textShadow: `0 0 10px ${color}` }}
        >
          {kmh}
        </span>
        <span className="mt-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/60">
          km/h
        </span>
      </div>
    </div>
  );
}

// Bar mocy / przyspieszenia poniżej gauge — pulsuje kolorem prędkości.
function SpeedBoostBar({ kmh, max = 200 }: { kmh: number; max?: number }) {
  const pct = Math.min(100, (kmh / max) * 100);
  const color = speedColor(kmh);
  return (
    <div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full transition-all"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    </div>
  );
}

const TOP_CLIP = 'polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)';
const BOTTOM_CLIP = 'polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)';

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

  const distToCurrent = userLocation && currentStep
    ? Math.min(
        haversineMeters(
          userLocation.latitude, userLocation.longitude,
          currentStep.maneuverLocation[1], currentStep.maneuverLocation[0]
        ),
        currentStep.distance
      )
    : currentStep?.distance ?? 0;

  return (
    <>
      {/* === TOP: instrukcja manewru === */}
      <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-3">
        {hasArrived ? (
          <div
            className="relative flex items-center gap-4 border-l-4 border-emerald-300 px-5 py-4 shadow-[0_0_30px_rgba(16,185,129,0.45)]"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.95) 0%, rgba(5,150,105,0.95) 100%)',
              clipPath: TOP_CLIP,
            }}
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-white/25 ring-2 ring-white/30">
              <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black uppercase tracking-widest text-lg text-white drop-shadow">Cel osiągnięty</p>
              <p className="text-xs font-bold uppercase tracking-wider text-white/80 truncate">{navDestName}</p>
            </div>
            <button
              onClick={onEndNavigation}
              className="shrink-0 rounded-md bg-white/20 px-4 py-2 text-xs font-black uppercase tracking-wider text-white ring-1 ring-white/40 transition hover:bg-white/30"
            >
              Zakończ
            </button>
          </div>
        ) : currentStep ? (
          <div
            className="relative overflow-hidden border-l-[6px] border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.30)] backdrop-blur-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(8,12,24,0.92) 0%, rgba(2,6,18,0.92) 100%)',
              clipPath: TOP_CLIP,
            }}
          >
            {/* Skanlines */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(34,211,238,0.6) 2px, rgba(34,211,238,0.6) 3px)',
              }}
            />
            <div className="relative flex items-center gap-4 px-4 py-3.5">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md text-white"
                style={{
                  background: 'linear-gradient(135deg, #22d3ee 0%, #2563eb 100%)',
                  boxShadow: '0 0 20px rgba(34,211,238,0.55)',
                }}
              >
                <ManeuverIcon type={currentStep.type} modifier={currentStep.modifier} size={36} />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="font-mono text-[2.6rem] font-black tabular-nums leading-none text-white"
                  style={{ textShadow: '0 0 14px rgba(34,211,238,0.7)' }}
                >
                  {fmtDist(distToCurrent)}
                </div>
                <div className="mt-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-100/85 truncate">
                  {currentStep.instruction || (currentStep.name ? `Jedź przez ${currentStep.name}` : 'Kontynuuj jazdę')}
                </div>
              </div>
            </div>
            {nextStep && (
              <div className="relative flex items-center gap-3 border-t border-cyan-400/20 bg-black/45 px-4 py-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white/10 text-cyan-200">
                  <ManeuverIcon type={nextStep.type} modifier={nextStep.modifier} size={16} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/55 truncate">
                  Potem · {nextStep.instruction || nextStep.name || 'Kontynuuj'}
                </span>
                <span
                  className="ml-auto shrink-0 font-mono text-[11px] font-black tabular-nums text-cyan-300"
                  style={{ textShadow: '0 0 6px rgba(34,211,238,0.7)' }}
                >
                  {fmtDist(nextStep.distance)}
                </span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* === BOTTOM-LEFT: gauge prędkości === */}
      <div className="absolute bottom-24 left-3 z-30 flex flex-col items-center">
        <SpeedGauge kmh={speedKmh} />
        <SpeedBoostBar kmh={speedKmh} />
      </div>

      {/* === BOTTOM: pasek ETA === */}
      <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-5">
        <div
          className="relative overflow-hidden border-t-2 border-cyan-400/55 backdrop-blur-xl"
          style={{
            background: 'linear-gradient(180deg, rgba(8,12,24,0.92) 0%, rgba(2,6,18,0.95) 100%)',
            clipPath: BOTTOM_CLIP,
            boxShadow: '0 -8px 28px rgba(34,211,238,0.18)',
          }}
        >
          {/* Glowing corner accent */}
          <div
            className="pointer-events-none absolute -bottom-6 left-1/2 h-12 w-32 -translate-x-1/2 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(34,211,238,0.5), transparent)' }}
          />
          <div className="relative flex items-center gap-5 px-6 py-3.5">
            <div className="min-w-0">
              <div
                className="font-mono text-2xl font-black tabular-nums leading-none text-white"
                style={{ textShadow: '0 0 8px rgba(34,211,238,0.55)' }}
              >
                {fmtETA(remainingDuration)}
              </div>
              <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/55">
                Przyjazd
              </div>
            </div>

            <div
              className="h-9 w-px"
              style={{ background: 'linear-gradient(180deg, transparent, rgba(34,211,238,0.6), transparent)' }}
            />

            <div className="min-w-0">
              <div
                className="font-mono text-lg font-black tabular-nums leading-none text-white"
                style={{ textShadow: '0 0 6px rgba(34,211,238,0.45)' }}
              >
                {fmtDist(remainingDistance)}
              </div>
              <div className="mt-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/55">
                {fmtTime(remainingDuration)}
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              {!isFollowing && (
                <button
                  onClick={() => onSetFollowing(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-white shadow-lg transition"
                  style={{
                    background: 'linear-gradient(135deg, #22d3ee 0%, #2563eb 100%)',
                    boxShadow: '0 0 14px rgba(34,211,238,0.6)',
                  }}
                  title="Wróć do trasy"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                  </svg>
                </button>
              )}
              <button
                onClick={onEndNavigation}
                className="flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition"
                style={{
                  background: 'linear-gradient(135deg, #f43f5e 0%, #b91c1c 100%)',
                  boxShadow: '0 0 14px rgba(244,63,94,0.55)',
                }}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                Zakończ
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
