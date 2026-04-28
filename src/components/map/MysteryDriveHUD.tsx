'use client';

import { useEffect, useRef, useState } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import { haversineMeters } from '@/lib/geo';

const CHECKPOINT_RADIUS_M = 40; // promień zaliczenia checkpointa

function formatTimeMs(seconds: number): string {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const cs = Math.floor((total - Math.floor(total)) * 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function formatDiffMs(diff: number): string {
  const sign = diff >= 0 ? '+' : '−';
  const abs = Math.abs(diff);
  return `${sign}${abs.toFixed(3)}s`;
}

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

  // Pobierz najlepszy czas dla trasy raz na uruchomienie wyzwania.
  // Najpierw publiczny leaderboard (globalny top), potem fallback na /times (znajomi+ja) dla prywatnych tras.
  const mysteryRouteId = mystery?.routeId ?? null;
  useEffect(() => {
    if (!mysteryRouteId) return;
    let cancelled = false;
    setTopSeconds(null);
    (async () => {
      const tryEndpoints = [
        `/api/routes/${mysteryRouteId}/leaderboard`,
        `/api/routes/${mysteryRouteId}/times`,
      ];
      for (const url of tryEndpoints) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const data = await r.json();
          let best: number | null = null;
          if (data?.entries && Array.isArray(data.entries) && data.entries[0]?.seconds) {
            best = data.entries[0].seconds;
          } else if (Array.isArray(data) && data[0]?.seconds) {
            best = data[0].seconds;
          }
          if (best !== null && Number.isFinite(best) && best > 0) {
            if (!cancelled) setTopSeconds(best);
            return;
          }
        } catch {
          // ignoruj i spróbuj następnego
        }
      }
    })();
    return () => { cancelled = true; };
  }, [mysteryRouteId]);

  // Countdown 5..0
  useEffect(() => {
    if (!mystery || mystery.status !== 'countdown' || mystery.countdown === null) return;
    if (mystery.countdown <= 0) {
      beginMysteryRun();
      return;
    }
    const t = setTimeout(() => setMysteryCountdown((mystery.countdown ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [mystery, setMysteryCountdown, beginMysteryRun]);

  // Reset finishingRef gdy nowy bieg
  useEffect(() => {
    if (mystery?.status === 'running') {
      finishingRef.current = false;
      setSavingError(null);
    }
  }, [mystery?.status]);

  // Centrowanie na pierwszym checkpoincie raz po starcie
  useEffect(() => {
    if (!mystery || mystery.status !== 'running') return;
    if (flewToFirstRef.current === mystery.routeId) return;
    flewToFirstRef.current = mystery.routeId;
    const wp = mystery.waypoints[0];
    if (wp) setMapFlyTarget({ longitude: wp.longitude, latitude: wp.latitude, zoom: 15 });
  }, [mystery, setMapFlyTarget]);

  // Tick zegara
  useEffect(() => {
    if (!mystery || mystery.status !== 'running' || !mystery.startedAt) return;
    const id = setInterval(() => {
      setElapsed((Date.now() - (mystery.startedAt ?? Date.now())) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [mystery?.status, mystery?.startedAt, mystery]);

  // Auto-advance + auto-finish na podstawie GPS
  useEffect(() => {
    if (!mystery || mystery.status !== 'running' || !userLocation) return;
    const wp = mystery.waypoints[mystery.currentIdx];
    if (!wp) return;
    const d = haversineMeters(userLocation.latitude, userLocation.longitude, wp.latitude, wp.longitude);
    if (d > CHECKPOINT_RADIUS_M) return;

    // Tryb checkpoint: pierwsze przejście przez PKT 0 uruchamia timer i przesuwa indeks.
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
      // Zapisz czas w tle
      fetch(`/api/routes/${mystery.routeId}/times`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds }),
      })
        .then(async (r) => {
          if (!r.ok) {
            const b = await r.json().catch(() => ({}));
            throw new Error(b?.error ?? `HTTP ${r.status}`);
          }
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

  // Dystans do bieżącego checkpointa
  let distLabel: string | null = null;
  if (isRunning && userLocation) {
    const wp = mystery.waypoints[mystery.currentIdx];
    if (wp) {
      const d = haversineMeters(userLocation.latitude, userLocation.longitude, wp.latitude, wp.longitude);
      distLabel = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(2)} km`;
    }
  }

  // Strata / przewaga vs najlepszy czas — interpolacja liniowa po postępie checkpointów.
  let diffSeconds: number | null = null;
  if (isRunning && topSeconds !== null) {
    const lastIdx = mystery.waypoints.length - 1;
    if (lastIdx > 0) {
      const progress = Math.min(1, mystery.currentIdx / lastIdx);
      const expected = topSeconds * progress;
      diffSeconds = elapsed - expected;
    }
  }

  return (
    <>
      {/* Top HUD */}
      {(isCountdown || isRunning) && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 w-[min(94vw,460px)] -translate-x-1/2">
          <div className="pointer-events-auto overflow-hidden rounded-2xl border border-rose-500/40 bg-black/70 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 bg-gradient-to-r from-rose-700/80 via-orange-600/80 to-amber-500/80 px-4 py-2">
              <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                NFS Drive
              </span>
              <span className="truncate text-xs font-semibold text-white">{mystery.routeName}</span>
              <button
                onClick={cancelMysteryDrive}
                className="ml-auto rounded-md bg-black/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white transition hover:bg-black/50"
              >
                Anuluj
              </button>
            </div>

            {isCountdown ? (
              <div className="flex flex-col items-center gap-1 px-4 py-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-300">Gotów? Start za…</p>
                <p className="font-mono text-6xl font-black text-rose-400 tabular-nums">{mystery.countdown ?? 0}</p>
              </div>
            ) : isWaitingForStart ? (
              <div className="flex flex-col items-center gap-2 px-4 py-5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 animate-ping rounded-full bg-amber-400" />
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">Oczekiwanie na start</p>
                </div>
                <p className="text-center text-sm font-bold text-white">
                  Przejedź przez <span className="text-amber-300">PKT 1</span>, aby uruchomić timer
                </p>
                {distLabel && (
                  <p className="font-mono text-base font-bold text-amber-200">{distLabel}</p>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 px-4 pt-3 pb-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/80">Czas</p>
                    <p className="font-mono text-base font-bold text-white tabular-nums">{formatTimeMs(elapsed)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/80">Punkt</p>
                    <p className="text-base font-bold text-white">
                      {mystery.currentIdx + 1}<span className="text-xs text-white/60"> / {total}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/80">Dystans</p>
                    <p className="text-base font-bold text-amber-300">{distLabel ?? '— m'}</p>
                  </div>
                </div>
                <div
                  className={`flex items-center justify-between gap-2 border-t border-white/10 px-4 py-2 ${
                    diffSeconds === null
                      ? 'bg-white/5'
                      : diffSeconds < 0
                        ? 'bg-emerald-600/25'
                        : 'bg-rose-600/25'
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
                    vs Top {topSeconds !== null ? `(${formatTimeMs(topSeconds)})` : ''}
                  </span>
                  {diffSeconds === null ? (
                    <span className="font-mono text-sm font-bold text-white/60">— brak rekordu —</span>
                  ) : (
                    <span
                      className={`font-mono text-lg font-black tabular-nums ${
                        diffSeconds < 0 ? 'text-emerald-300' : 'text-rose-300'
                      }`}
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

      {/* Summary (finished / cancelled) */}
      {(isFinished || isCancelled) && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-rose-500/40 bg-card-bg shadow-2xl">
            <div className={`px-5 py-4 ${isFinished ? 'bg-gradient-to-br from-emerald-700 to-teal-700' : 'bg-gradient-to-br from-slate-700 to-slate-800'}`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70">
                {isFinished ? 'Meta osiągnięta!' : 'Wyzwanie przerwane'}
              </p>
              <p className="mt-1 truncate text-base font-bold text-white">{mystery.routeName}</p>
            </div>
            <div className="px-5 py-4">
              {isFinished && mystery.savedSeconds !== null ? (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Twój czas</p>
                  <p className="font-mono text-3xl font-black text-orange-400 tabular-nums">
                    {formatTimeMs(mystery.savedSeconds)}
                  </p>
                  {savingError && (
                    <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-400">
                      Czas zapisany lokalnie, ale serwer odrzucił: {savingError}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">Nie ma zapisu czasu — możesz spróbować ponownie.</p>
              )}
              <button
                onClick={clearMysteryDrive}
                className="mt-4 w-full rounded-xl bg-orange-600 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
