'use client';

import { fmtDist, fmtTripTime } from '@/lib/mapNavigation';

interface FinishedTrip {
  distance: number;
  duration: number;
  maxSpeed: number;
  avgSpeed: number;
}

interface TripSummaryModalProps {
  show: boolean;
  trip: FinishedTrip | null;
  onClose: () => void;
}

export default function TripSummaryModal({ show, trip, onClose }: TripSummaryModalProps) {
  if (!show || !trip) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-card-border bg-card-bg p-6 shadow-2xl">
        <h2 className="mb-1 text-lg font-bold text-foreground">Podróż zakończona</h2>
        <p className="mb-5 text-xs text-muted">
          {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <div className="mb-5 grid grid-cols-2 gap-3">
          {[
            { label: 'Czas', value: fmtTripTime(trip.duration) },
            { label: 'Dystans', value: fmtDist(trip.distance) },
            { label: 'Max prędkość', value: `${Math.round(trip.maxSpeed)} km/h` },
            { label: 'Śr. prędkość', value: `${Math.round(trip.avgSpeed)} km/h` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-input-bg px-4 py-3">
              <p className="text-lg font-extrabold text-foreground">{value}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Zamknij
        </button>
      </div>
    </div>
  );
}
