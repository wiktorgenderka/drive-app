'use client';

import { useMemo, useEffect, useRef } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import { calculateDistance, formatDistance } from '@/lib/utils';

const ALERT_RADIUS = 5000;   // show in list
const AUDIO_RADIUS = 500;    // play audio + vibrate
const MAX_ALERTS = 3;

const REPORT_META: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  POLICE:          { label: 'Policja',              color: 'text-blue-400',   bg: 'bg-blue-500/15',   border: 'border-accent/30',   icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  UNMARKED_POLICE: { label: 'Tajniaki',             color: 'text-indigo-400', bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
  SPEED_TRAP:      { label: 'Kontrola prÄ™dkoĹ›ci',   color: 'text-yellow-400', bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', icon: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z' },
  ACCIDENT:        { label: 'Wypadek',              color: 'text-red-400',    bg: 'bg-red-500/15',    border: 'border-red-500/30',    icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
  OBSTACLE:        { label: 'Przeszkoda',           color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30', icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  SPEED_CAMERA:    { label: 'Fotoradar',            color: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30', icon: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z' },
};

// POLICE/ACCIDENT â€” one-shot beep when entering radius (different from SpeedCameraAlert which loops)
const AUDIO_TYPES = new Set(['POLICE', 'UNMARKED_POLICE', 'ACCIDENT']);

function playAlert(ctx: AudioContext, type: string) {
  try {
    const freqs = type === 'ACCIDENT' ? [440, 330] : [880, 660, 880];
    let t = ctx.currentTime;
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.18);
      t += 0.22;
    }
  } catch { /* autoplay blocked */ }
}

export default function NearbyReportAlert() {
  const userLocation = useMapStore((s) => s.userLocation);
  const reports = useMapStore((s) => s.reports);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const alertedRef = useRef<Set<string>>(new Set());

  const nearbyReports = useMemo(() => {
    if (!userLocation || reports.length === 0) return [];
    return reports
      .map((r) => ({
        ...r,
        distance: calculateDistance(userLocation.latitude, userLocation.longitude, r.latitude, r.longitude),
      }))
      .filter((r) => r.distance <= ALERT_RADIUS)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_ALERTS);
  }, [userLocation, reports]);

  // One-shot audio + vibration when entering AUDIO_RADIUS for POLICE/ACCIDENT types
  useEffect(() => {
    for (const r of nearbyReports) {
      if (!AUDIO_TYPES.has(r.type)) continue;
      if (r.distance > AUDIO_RADIUS) {
        alertedRef.current.delete(r.id); // reset so alert can fire again when re-entering
        continue;
      }
      if (alertedRef.current.has(r.id)) continue;
      alertedRef.current.add(r.id);

      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      playAlert(audioCtxRef.current, r.type);

      if ('vibrate' in navigator) {
        navigator.vibrate(r.type === 'ACCIDENT' ? [300, 100, 300] : [200, 100, 200, 100, 200]);
      }
    }
  }, [nearbyReports]);

  if (nearbyReports.length === 0) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
      {nearbyReports.map((report) => {
        const meta = REPORT_META[report.type] ?? REPORT_META.OBSTACLE;
        const dist = formatDistance(report.distance);
        const isClose = report.distance <= AUDIO_RADIUS;

        return (
          <div
            key={report.id}
            className={`flex items-center gap-3 rounded-2xl border ${meta.border} ${meta.bg} px-4 py-2.5 shadow-xl backdrop-blur-md pointer-events-auto animate-slide-up ${isClose ? 'ring-1 ring-white/20' : ''}`}
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.color}`}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${meta.color}`}>{meta.label}</p>
              {isClose && <p className="text-[11px] text-white/60">Uwaga!</p>}
            </div>
            <span className="shrink-0 text-sm font-bold text-foreground">{dist}</span>
          </div>
        );
      })}
    </div>
  );
}
