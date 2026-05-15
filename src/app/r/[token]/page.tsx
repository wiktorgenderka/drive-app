'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

interface Waypoint { latitude: number; longitude: number; name?: string; }
interface RouteUser { id: string; name: string; image: string | null; }
interface SharedRoute {
  id: string;
  name: string;
  description: string | null;
  waypoints: Waypoint[];
  distance: number | null;
  duration: number | null;
  avgRating: number | null;
  ratingCount: number;
  createdAt: string;
  user: RouteUser;
}

function formatDistance(m: number | null) {
  if (!m) return '—';
  return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : m.toFixed(0) + ' m';
}
function formatDuration(s: number | null) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? h + 'h ' + m + 'min' : m + ' min';
}

export default function SharedRoutePage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';
  const [route, setRoute] = useState<SharedRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch('/api/routes/shared/' + token)
      .then((r) => {
        if (!r.ok) throw new Error('Nie znaleziono trasy');
        return r.json();
      })
      .then((data) => {
        const wps = Array.isArray(data.waypoints)
          ? data.waypoints.map((w: Record<string, number>) => ({
              latitude: w.latitude ?? w.lat ?? 0,
              longitude: w.longitude ?? w.lng ?? 0,
              name: w.name,
            }))
          : [];
        setRoute({ ...data, waypoints: wps });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const staticMapUrl = useMemo(() => {
    if (!route || !mapboxToken || route.waypoints.length < 2) return null;
    const coords = route.waypoints.map((w) => w.longitude + ',' + w.latitude).join(';');
    const path = 'path-3+f97316-0.8(' + encodeURIComponent(coords) + ')';
    const start = route.waypoints[0];
    const end = route.waypoints[route.waypoints.length - 1];
    const center = ((start.longitude + end.longitude) / 2) + ',' + ((start.latitude + end.latitude) / 2);
    return 'https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/' + path + '/' + center + ',10,0/640x360@2x?access_token=' + mapboxToken;
  }, [route, mapboxToken]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <svg className="h-8 w-8 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-2xl">🔗</p>
        <h1 className="text-xl font-bold text-foreground">Trasa nie istnieje</h1>
        <p className="text-sm text-muted">{error || 'Link może być nieprawidłowy lub trasa została usunięta.'}</p>
        <a href="/dashboard" className="mt-2 rounded-xl bg-accent px-6 py-2 text-sm font-semibold text-accent-fg transition hover:bg-accent/80">
          Wróć do aplikacji
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <a href="/dashboard" className="flex items-center gap-2 text-sm text-muted transition hover:text-foreground">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Wróć
          </a>
          <span className="text-xs font-bold uppercase tracking-widest text-orange-400">DriveApp</span>
        </div>

        {/* Route card */}
        <div className="overflow-hidden rounded-2xl border border-card-border bg-card-bg shadow-xl">
          {/* Map preview */}
          {staticMapUrl && (
            <img
              src={staticMapUrl}
              alt={'Podgląd trasy ' + route.name}
              className="h-48 w-full object-cover sm:h-64"
              loading="lazy"
            />
          )}

          <div className="p-6">
            <h1 className="mb-1 text-2xl font-bold text-foreground">{route.name}</h1>
            {route.description && (
              <p className="mb-4 text-sm text-muted">{route.description}</p>
            )}

            {/* Stats row */}
            <div className="mb-5 grid grid-cols-3 gap-3">
              {[
                { label: 'Dystans', value: formatDistance(route.distance) },
                { label: 'Czas', value: formatDuration(route.duration) },
                { label: 'Punkty', value: route.waypoints.length.toString() },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-card-border bg-input-bg p-3 text-center">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="mt-0.5 text-lg font-bold text-foreground">{value}</p>
                </div>
              ))}
            </div>

            {/* Rating */}
            {route.ratingCount > 0 && route.avgRating && (
              <div className="mb-5 flex items-center gap-2 text-sm">
                <span className="text-yellow-400">★</span>
                <span className="font-semibold text-foreground">{route.avgRating.toFixed(1)}</span>
                <span className="text-muted">({route.ratingCount} ocen)</span>
              </div>
            )}

            {/* Author */}
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-card-border bg-input-bg p-3">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-card-border">
                {route.user.image
                  ? <img src={route.user.image} alt={route.user.name} loading="lazy" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center text-sm font-bold text-muted">
                      {route.user.name[0]?.toUpperCase()}
                    </div>
                }
              </div>
              <div>
                <p className="text-xs text-muted">Udostępnił/a</p>
                <p className="text-sm font-semibold text-foreground">{route.user.name}</p>
              </div>
            </div>

            {/* Waypoints list */}
            {route.waypoints.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Punkty trasy</p>
                <ol className="space-y-1.5">
                  {route.waypoints.map((wp, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-[10px] font-bold text-orange-400">
                        {i + 1}
                      </span>
                      <span className="text-muted">
                        {wp.name || (wp.latitude.toFixed(4) + ', ' + wp.longitude.toFixed(4))}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* CTA */}
            <div className="mt-6">
              <a
                href="/dashboard"
                className="block w-full rounded-xl bg-accent py-3 text-center text-sm font-bold text-accent-fg transition hover:bg-accent/90"
              >
                Otwórz w DriveApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}