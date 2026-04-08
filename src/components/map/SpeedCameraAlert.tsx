'use client';

import { useEffect, useRef, useState } from 'react';
import type { Report, UserLocation } from '@/stores/useMapStore';

function distMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function playBeep(ctx: AudioContext, freq: number) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch { /* ignore */ }
}

interface Props {
  userLocation: UserLocation | null;
  reports: Report[];
}

const ALERT_DIST = 500;

export default function SpeedCameraAlert({ userLocation, reports }: Props) {
  const [closest, setClosest] = useState<{ report: Report; dist: number } | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  // recompute closest camera on every location update
  useEffect(() => {
    if (!userLocation) { setClosest(null); return; }

    const cams = reports.filter(
      (r) => r.type === 'SPEED_CAMERA' || r.type === 'SPEED_TRAP'
    );
    let best: { report: Report; dist: number } | null = null;

    for (const r of cams) {
      const d = distMeters(
        userLocation.latitude, userLocation.longitude,
        r.latitude, r.longitude
      );
      if (d <= ALERT_DIST && (!best || d < best.dist)) {
        best = { report: r, dist: d };
      }
    }

    setClosest(best);
  }, [userLocation, reports]);

  // beep interval based on distance band
  const distBand = closest ? Math.floor(closest.dist / 100) : -1;

  useEffect(() => {
    if (!closest) return;

    const beepMs = closest.dist < 200 ? 700 : closest.dist < 350 ? 1400 : 2800;

    const id = setInterval(() => {
      if (!audioRef.current) {
        audioRef.current = new AudioContext();
      }
      playBeep(audioRef.current, closest.dist < 200 ? 880 : 660);
    }, beepMs);

    // fire immediately on first appearance
    if (!audioRef.current) audioRef.current = new AudioContext();
    playBeep(audioRef.current, closest.dist < 200 ? 880 : 660);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distBand, !!closest]);

  if (!closest) return null;

  const isCritical = closest.dist < 200;
  const isCamera = closest.report.type === 'SPEED_CAMERA';
  const pct = Math.round(((ALERT_DIST - closest.dist) / ALERT_DIST) * 100);

  return (
    <div
      className="absolute left-3 right-3 z-30 overflow-hidden rounded-2xl shadow-2xl"
      style={{ top: '76px' }}
    >
      {/* Progress bar */}
      <div className="h-1 w-full" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: isCritical ? '#fca5a5' : '#fde68a',
          }}
        />
      </div>

      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: isCritical ? '#dc2626' : '#d97706' }}
      >
        {/* Icon */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/20">
          <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            {isCamera ? (
              <>
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </>
            ) : (
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            )}
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1">
          <p className="text-sm font-bold text-white">
            {isCamera ? 'Fotoradar' : 'Kontrola prędkości'}
          </p>
          <p className="text-xs text-white/75">
            {isCritical ? 'Zwalniaj!' : 'Zbliżasz się'}
          </p>
        </div>

        {/* Distance badge */}
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-black/25">
          <span className="text-base font-extrabold leading-none text-white">
            {Math.round(closest.dist)}
          </span>
          <span className="text-[9px] font-semibold text-white/70">m</span>
        </div>
      </div>
    </div>
  );
}
