'use client';

import { useEffect, useRef, useState } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import { haversineMeters } from '@/lib/geo';

const CHECKPOINT_RADIUS_M = 40;

function formatTimeMs(seconds: number): string {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const cs = Math.floor((total - Math.floor(total)) * 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function formatDiffMs(diff: number): string {
  const sign = diff >= 0 ? '+' : '−';
  return `${sign}${Math.abs(diff).toFixed(3)}s`;
}

const CLIP_TR = 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)';
const CLIP_FULL = 'polygon(0 14px, 14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)';
const CLIP_BTN = 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)';

const SCANLINES: React.CSSProperties = {
  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 3px)',
};

export default function MysteryDriveHUD() {
  const mystery = useMapStore((s) => s.mysteryDrive);
  const userLocation = useMapStore((s) => s.userLocation);
  const setMapFlyTarget = useMapStore((s) => s.setMapFlyTarget);
  const setMysteryCountdown = useMapStore((s) => s.setMysteryCountdown);
  const beginMysteryRun = useMapStore((s) => s.beginMysteryRun);
  const triggerMysteryStart = useMapStore((s) => s.triggerMysteryStart);
  const advanceMysteryCheckpoint = useMapStore((s) => s.advanceMysteryCheckpoint);
  const finishMysteryDrive = useMapStore((s) => s.finishMysteryDrive);
  const cancelMysteryDrive = useMapStore((s) => s.cancelMysteryDrive);
  const clearMysteryDrive = useMapStore((s) => s.clearMysteryDrive);

  const [elapsed, setElapsed] = useState(0);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [topSeconds, setTopSeconds] = useState<number | null>(null);
  const finishingRef = useRef(false);
  const flewToFirstRef = useRef<string | null>(null);

  const mysteryRouteId = mystery?.routeId ?? null;
  useEffect(() => {
    if (!mysteryRouteId) return;
    let cancelled = false;
    setTopSeconds(null);
    (async () => {
      for (const url of [`/api/routes/${mysteryRouteId}/leaderboard`, `/api/routes/${mysteryRouteId}/times`]) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const data = await r.json();
          let best: number | null = null;
          if (data?.entries?.[0]?.seconds) best = data.entries[0].seconds;
          else if (Array.isArray(data) && data[0]?.seconds) best = data[0].seconds;
          if (best !== null && Number.isFinite(best) && best > 0) {
            if (!cancelled) setTopSeconds(best);
            return;
          }
        } catch { /* skip */ }
      }
    })();
    return () => { cancelled = true; };
  }, [mysteryRouteId]);

  useEffect(() => {
    if (!mystery || mystery.status !== 'countdown' || mystery.countdown === null) return;
    if (mystery.countdown <= 0) { beginMysteryRun(); return; }
    const t = setTimeout(() => setMysteryCountdown((mystery.countdown ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [mystery, setMysteryCountdown, beginMysteryRun]);

  useEffect(() => {
    if (mystery?.status === 'running') { finishingRef.current = false; setSavingError(null); }
  }, [mystery?.status]);

  useEffect(() => {
    if (!mystery || mystery.status !== 'running') return;
    if (flewToFirstRef.current === mystery.routeId) return;
    flewToFirstRef.current = mystery.routeId;
    const wp = mystery.waypoints[0];
    if (wp) setMapFlyTarget({ longitude: wp.longitude, latitude: wp.latitude, zoom: 15 });
  }, [mystery, setMapFlyTarget]);

  useEffect(() => {
    if (!mystery || mystery.status !== 'running' || !mystery.startedAt) return;
    const id = setInterval(() => {
      setElapsed((Date.now() - (mystery.startedAt ?? Date.now())) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [mystery?.status, mystery?.startedAt, mystery]);

  useEffect(() => {
    if (!mystery || mystery.status !== 'running' || !userLocation) return;
    const wp = mystery.waypoints[mystery.currentIdx];
    if (!wp) return;
    const d = haversineMeters(userLocation.latitude, userLocation.longitude, wp.latitude, wp.longitude);
    if (d > CHECKPOINT_RADIUS_M) return;

    if (mystery.startMode === 'checkpoint' && mystery.startedAt === null) {
      triggerMysteryStart();
      advanceMysteryCheckpoint();
      return;
    }

    const isLast = mystery.currentIdx >= mystery.waypoints.length - 1;
    if (isLast) {
      if (finishingRef.current) return;
      finishingRef.current = true;
      const seconds = Math.max(1, Math.round(((mystery.startedAt ? Date.now() - mystery.startedAt : 0)) / 1000));
      finishMysteryDrive(seconds);
      fetch(`/api/routes/${mystery.routeId}/times`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
        })
        .catch((e: Error) => setSavingError(e.message));
    } else {
      advanceMysteryCheckpoint();
    }
  }, [userLocation, mystery, triggerMysteryStart, advanceMysteryCheckpoint, finishMysteryDrive]);

  if (!mystery) return null;

  const total = mystery.waypoints.length;
  const isCountdown = mystery.status === 'countdown';
  const isRunning = mystery.status === 'running';
  const isWaitingForStart = isRunning && mystery.startMode === 'checkpoint' && mystery.startedAt === null;
  const isFinished = mystery.status === 'finished';
  const isCancelled = mystery.status === 'cancelled';

  let distLabel: string | null = null;
  if (isRunning && userLocation) {
    const wp = mystery.waypoints[mystery.currentIdx];
    if (wp) {
      const d = haversineMeters(userLocation.latitude, userLocation.longitude, wp.latitude, wp.longitude);
      distLabel = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(2)} km`;
    }
  }

  let diffSeconds: number | null = null;
  if (isRunning && topSeconds !== null && mystery.waypoints.length > 1) {
    const progress = Math.min(1, mystery.currentIdx / (mystery.waypoints.length - 1));
    diffSeconds = elapsed - topSeconds * progress;
  }

  return (
    <>
      {/* ── TOP HUD ── */}
      {(isCountdown || isRunning) && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 w-[min(96vw,440px)] -translate-x-1/2">
          <div
            className="pointer-events-auto relative overflow-hidden"
            style={{
              clipPath: CLIP_TR,
              background: 'rgba(4,4,4,0.92)',
              boxShadow: '0 0 0 1px rgba(249,115,22,0.35), 0 12px 40px rgba(0,0,0,0.85), 0 0 50px rgba(249,115,22,0.1)',
            }}
          >
            {/* Scanlines */}
            <div className="pointer-events-none absolute inset-0 z-10 opacity-100" style={SCANLINES} />
            {/* Top accent stripe */}
            <div className="h-[2px] w-full" style={{ background: 'linear-gradient(90deg, #e11d48, #f97316 45%, #fbbf24)' }} />

            {/* Header */}
            <div className="relative z-20 flex items-center gap-2.5 px-3.5 py-2">
              <div className="flex shrink-0 items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 shrink-0"
                  style={{ background: 'linear-gradient(135deg,#f97316,#ef4444)', clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' }}
                />
                <span className="text-[9px] font-black uppercase tracking-[0.26em] text-orange-400">NFS Drive</span>
              </div>
              <div className="mx-1 h-3 w-px bg-white/15" />
              <span className="min-w-0 truncate text-[10px] font-semibold text-white/55">{mystery.routeName}</span>
              <button
                onClick={cancelMysteryDrive}
                className="pointer-events-auto relative z-30 ml-auto flex h-6 w-6 shrink-0 items-center justify-center transition hover:brightness-125"
                style={{ background: 'rgba(239,68,68,0.18)', clipPath: CLIP_FULL }}
              >
                <svg className="h-3 w-3 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* ── COUNTDOWN ── */}
            {isCountdown && (
              <div className="relative z-20 flex flex-col items-center pb-7 pt-1">
                <p className="text-[9px] font-black uppercase tracking-[0.32em] text-orange-400/70">Get Ready</p>
                <div key={mystery.countdown} style={{ animation: 'nfs-pop 0.35s cubic-bezier(.17,.67,.35,1.3)' }}>
                  <p
                    className="font-mono font-black tabular-nums leading-none"
                    style={{
                      fontSize: mystery.countdown === 0 ? '5rem' : '6rem',
                      color: mystery.countdown === 0 ? '#22d3ee' : mystery.countdown === 1 ? '#f43f5e' : '#f97316',
                      textShadow: mystery.countdown === 0
                        ? '0 0 30px #22d3ee, 0 0 70px rgba(34,211,238,0.5)'
                        : mystery.countdown === 1
                          ? '0 0 30px #f43f5e, 0 0 70px rgba(244,63,94,0.5)'
                          : '0 0 30px #f97316, 0 0 70px rgba(249,115,22,0.5)',
                    }}
                  >
                    {mystery.countdown === 0 ? 'GO!' : mystery.countdown}
                  </p>
                </div>
                {/* Dash lines */}
                <div className="mt-3 flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-0.5 w-5"
                      style={{
                        background: i < (5 - (mystery.countdown ?? 5))
                          ? '#f97316'
                          : 'rgba(255,255,255,0.12)',
                        boxShadow: i < (5 - (mystery.countdown ?? 5)) ? '0 0 6px #f97316' : 'none',
                        transition: 'background 0.3s, box-shadow 0.3s',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── WAITING FOR CHECKPOINT ── */}
            {isWaitingForStart && (
              <div className="relative z-20 flex items-center gap-3 px-4 py-3.5">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                  <span
                    className="absolute inset-0 animate-ping"
                    style={{ background: 'rgba(251,191,36,0.25)', clipPath: CLIP_FULL }}
                  />
                  <span
                    className="relative z-10 flex h-9 w-9 items-center justify-center text-sm font-black text-black"
                    style={{ background: '#fbbf24', clipPath: CLIP_FULL }}
                  >
                    1
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-400">
                    Jedź do PKT 1 → start timera
                  </p>
                  {distLabel && (
                    <p className="mt-0.5 font-mono text-2xl font-black tabular-nums text-white">
                      {distLabel}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── RUNNING ── */}
            {isRunning && !isWaitingForStart && (
              <>
                {/* Big timer */}
                <div className="relative z-20 px-4 pt-2">
                  <p
                    className="font-mono text-[2.6rem] font-black tabular-nums leading-none tracking-tight text-white"
                    style={{ textShadow: '0 0 18px rgba(249,115,22,0.55)' }}
                  >
                    {formatTimeMs(elapsed)}
                  </p>
                </div>

                {/* Checkpoint progress */}
                <div className="relative z-20 mt-2.5 px-4">
                  <div className="flex items-center gap-1">
                    {mystery.waypoints.map((_, i) => (
                      <div
                        key={i}
                        className="h-[3px] flex-1 transition-all duration-300"
                        style={{
                          background: i < mystery.currentIdx
                            ? '#f97316'
                            : i === mystery.currentIdx
                              ? '#fbbf24'
                              : 'rgba(255,255,255,0.12)',
                          boxShadow: i === mystery.currentIdx
                            ? '0 0 8px rgba(251,191,36,0.8)'
                            : i < mystery.currentIdx
                              ? '0 0 6px rgba(249,115,22,0.5)'
                              : 'none',
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-orange-400/80">
                      PKT {mystery.currentIdx + 1} / {total}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-amber-300">
                      {distLabel ?? '—'}
                    </span>
                  </div>
                </div>

                {/* VS record */}
                <div
                  className="relative z-20 mt-2 flex items-center justify-between border-t px-4 py-2"
                  style={{
                    borderColor: 'rgba(255,255,255,0.07)',
                    background: diffSeconds === null
                      ? 'rgba(255,255,255,0.02)'
                      : diffSeconds < 0
                        ? 'rgba(16,185,129,0.1)'
                        : 'rgba(239,68,68,0.1)',
                  }}
                >
                  <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
                    {topSeconds !== null ? `vs top ${formatTimeMs(topSeconds)}` : 'vs top'}
                  </span>
                  {diffSeconds === null ? (
                    <span className="text-[10px] font-bold text-white/25">brak rekordu</span>
                  ) : (
                    <span
                      className="font-mono text-base font-black tabular-nums"
                      style={{
                        color: diffSeconds < 0 ? '#34d399' : '#f87171',
                        textShadow: diffSeconds < 0 ? '0 0 10px rgba(52,211,153,0.6)' : '0 0 10px rgba(248,113,113,0.6)',
                      }}
                    >
                      {formatDiffMs(diffSeconds)}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── FINISH / CANCELLED overlay ── */}
      {(isFinished || isCancelled) && (
        <div
          className="absolute inset-0 z-40 flex items-center justify-center px-5"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="relative w-full max-w-sm overflow-hidden"
            style={{
              clipPath: CLIP_TR,
              background: '#060606',
              boxShadow: '0 0 0 1px rgba(249,115,22,0.4), 0 24px 64px rgba(0,0,0,0.95), 0 0 60px rgba(249,115,22,0.12)',
            }}
          >
            {/* Scanlines */}
            <div className="pointer-events-none absolute inset-0 z-10 opacity-60" style={SCANLINES} />
            {/* Top stripe */}
            <div className="relative z-20 h-[2px] w-full" style={{ background: 'linear-gradient(90deg,#e11d48,#f97316 50%,#fbbf24)' }} />
            {/* Checkered strip on finish */}
            {isFinished && (
              <div
                className="relative z-20 h-6 w-full opacity-70"
                style={{ background: 'repeating-conic-gradient(rgba(255,255,255,0.07) 0% 25%, transparent 0% 50%) 0 0/16px 16px' }}
              />
            )}
            {/* Header */}
            <div
              className="relative z-20 px-5 pb-2 pt-4"
              style={{ background: isFinished ? 'linear-gradient(135deg,rgba(249,115,22,0.12),transparent)' : 'transparent' }}
            >
              <p
                className="text-[9px] font-black uppercase tracking-[0.3em]"
                style={{ color: isFinished ? '#fb923c' : '#64748b' }}
              >
                {isFinished ? '▶  Finish' : '■  Przerwano'}
              </p>
              <p className="mt-0.5 truncate text-[13px] font-bold text-white/70">{mystery.routeName}</p>
            </div>

            {/* Body */}
            <div className="relative z-20 px-5 pb-6">
              {isFinished && mystery.savedSeconds !== null ? (
                <>
                  <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Twój czas</p>
                  <p
                    className="font-mono text-5xl font-black tabular-nums leading-tight"
                    style={{ color: '#fb923c', textShadow: '0 0 28px rgba(251,146,60,0.65)' }}
                  >
                    {formatTimeMs(mystery.savedSeconds)}
                  </p>
                  {topSeconds !== null && (() => {
                    const diff = mystery.savedSeconds! - topSeconds;
                    return (
                      <p
                        className="mt-1 font-mono text-sm font-black tabular-nums"
                        style={{ color: diff <= 0 ? '#34d399' : '#f87171' }}
                      >
                        {diff <= 0 ? '▲ NOWY REKORD!' : `+${Math.abs(diff).toFixed(3)}s vs Top`}
                      </p>
                    );
                  })()}
                  {savingError && (
                    <p className="mt-2 text-[10px] text-rose-400">{savingError}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-white/40">Brak zapisu czasu.</p>
              )}

              <button
                onClick={clearMysteryDrive}
                className="relative z-30 mt-5 flex w-full items-center justify-center py-3 text-sm font-black uppercase tracking-[0.22em] text-white transition hover:brightness-110"
                style={{
                  background: 'linear-gradient(90deg,#dc2626,#f97316)',
                  clipPath: CLIP_BTN,
                  boxShadow: '0 0 18px rgba(249,115,22,0.35)',
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes nfs-pop {
          0%   { transform: scale(1.25); opacity: 0.2; }
          55%  { transform: scale(0.93); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
