'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface Trip {
  id: string;
  startedAt: string;
  endedAt: string;
  distanceKm: number | null;
  maxSpeedKmh: number | null;
  avgSpeedKmh: number | null;
  durationMin: number | null;
}

function formatDuration(min: number | null): string {
  if (!min) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return `Dzisiaj, ${d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return `Wczoraj, ${d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-sm font-bold text-foreground tabular-nums">{value}</span>
      <span className="text-[10px] text-muted">{label}</span>
    </div>
  );
}

export default function TripHistoryPanel() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const LIMIT = 10;

  const fetchTrips = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trips?page=${p}&limit=${LIMIT}`);
      if (res.ok) {
        const data = await res.json();
        setTrips(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTrips(page); }, [fetchTrips, page]);

  // Aggregate stats
  const totalKm = trips.reduce((s, t) => s + (t.distanceKm ?? 0), 0);
  const avgSpeed = trips.length
    ? Math.round(trips.reduce((s, t) => s + (t.avgSpeedKmh ?? 0), 0) / trips.filter((t) => t.avgSpeedKmh).length || 0)
    : 0;
  const topSpeed = Math.max(0, ...trips.map((t) => t.maxSpeedKmh ?? 0));

  if (loading && trips.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    );
  }

  if (!loading && trips.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-card-border bg-card-bg/50 py-16 text-center">
        <span className="text-5xl">🛣️</span>
        <div>
          <p className="text-sm font-semibold text-foreground">Brak zapisanych przejazdów</p>
          <p className="mt-1 text-xs text-muted">Naciśnij REC na mapie aby zacząć nagrywać trasę</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Summary row */}
      {trips.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: `${totalKm.toFixed(0)} km`, label: 'Łącznie (strona)' },
            { value: avgSpeed > 0 ? `${avgSpeed} km/h` : '—', label: 'Śr. prędkość' },
            { value: topSpeed > 0 ? `${topSpeed} km/h` : '—', label: 'Maks. prędkość' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 rounded-xl bg-input-bg py-3">
              <span className="text-base font-extrabold text-accent tabular-nums">{s.value}</span>
              <span className="text-[10px] text-muted">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Trip list */}
      <div className="flex flex-col gap-2">
        {trips.map((trip, i) => (
          <motion.div
            key={trip.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="overflow-hidden rounded-2xl border border-card-border bg-card-bg"
          >
            {/* Orange top accent */}
            <div className="h-0.5 w-full bg-gradient-to-r from-accent to-orange-600" />

            <div className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted">{formatDate(trip.startedAt)}</p>
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                  +50 XP
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg">🚗</span>
                  <div>
                    <p className="text-sm font-bold text-foreground tabular-nums">
                      {trip.distanceKm != null ? `${trip.distanceKm.toFixed(1)} km` : '— km'}
                    </p>
                    <p className="text-[11px] text-muted">{formatDuration(trip.durationMin)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  {trip.avgSpeedKmh != null && (
                    <StatBadge value={`${Math.round(trip.avgSpeedKmh)}`} label="śr. km/h" />
                  )}
                  {trip.maxSpeedKmh != null && (
                    <StatBadge value={`${Math.round(trip.maxSpeedKmh)}`} label="maks. km/h" />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl border border-card-border px-4 py-2 text-sm text-muted transition hover:text-foreground disabled:opacity-30"
          >
            ← Poprzednia
          </button>
          <span className="text-xs text-muted">
            {page + 1} / {Math.ceil(total / LIMIT)}
          </span>
          <button
            disabled={(page + 1) * LIMIT >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border border-card-border px-4 py-2 text-sm text-muted transition hover:text-foreground disabled:opacity-30"
          >
            Następna →
          </button>
        </div>
      )}
    </div>
  );
}
