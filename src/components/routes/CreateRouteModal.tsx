'use client';

import { useState, useRef, useCallback, useEffect, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { useMapStore } from '@/stores/useMapStore';

const MapWaypointPicker = dynamic(() => import('./MapWaypointPicker'), { ssr: false });

interface Waypoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
}

interface CreateRouteModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function CreateRouteModal({ open, onClose, onCreated }: CreateRouteModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const userLocation = useMapStore((s) => s.userLocation);

  const searchPlaces = useCallback(
    async (query: string) => {
      if (!query.trim() || !MAPBOX_TOKEN) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const proximity = userLocation
          ? `&proximity=${userLocation.longitude},${userLocation.latitude}`
          : '';
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            query
          )}.json?access_token=${MAPBOX_TOKEN}&limit=5&language=pl${proximity}`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setSearchResults(
          (data.features ?? []).map((f: { id: string; place_name: string; center: [number, number] }) => ({
            id: f.id,
            place_name: f.place_name,
            center: f.center,
          }))
        );
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [userLocation]
  );

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchPlaces(value), 300);
  }

  function addWaypoint(result: SearchResult) {
    setWaypoints((prev) => [
      ...prev,
      {
        id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        latitude: result.center[1],
        longitude: result.center[0],
        label: result.place_name.split(',')[0],
      },
    ]);
    setSearchQuery('');
    setSearchResults([]);
  }

  function addCurrentLocation() {
    if (!userLocation) return;
    setWaypoints((prev) => [
      ...prev,
      {
        id: `wp-${Date.now()}-loc`,
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        label: 'Moja lokalizacja',
      },
    ]);
  }

  function removeWaypoint(id: string) {
    setWaypoints((prev) => prev.filter((wp) => wp.id !== id));
  }

  function moveWaypoint(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= waypoints.length) return;
    const arr = [...waypoints];
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    setWaypoints(arr);
  }

  function closeLoop() {
    if (waypoints.length < 2) return;
    const first = waypoints[0];
    setWaypoints((prev) => [
      ...prev,
      {
        id: `wp-${Date.now()}-loop`,
        latitude: first.latitude,
        longitude: first.longitude,
        label: first.label,
      },
    ]);
  }

  const isLoop =
    waypoints.length >= 2 &&
    waypoints[0].latitude === waypoints[waypoints.length - 1].latitude &&
    waypoints[0].longitude === waypoints[waypoints.length - 1].longitude;

  // Route preview — distance & duration from Mapbox Directions API
  const [routePreview, setRoutePreview] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (waypoints.length < 2 || !MAPBOX_TOKEN) {
      setRoutePreview(null);
      return;
    }
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    previewTimeoutRef.current = setTimeout(async () => {
      try {
        const coords = waypoints.map((wp) => `${wp.longitude},${wp.latitude}`).join(';');
        const excludeParts: string[] = [];
        if (avoidTolls) excludeParts.push('toll');
        if (avoidHighways) excludeParts.push('motorway');
        const excludeParam = excludeParts.length > 0 ? `&exclude=${excludeParts.join(',')}` : '';
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?access_token=${MAPBOX_TOKEN}&overview=false${excludeParam}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const route = data.routes?.[0];
        if (route) {
          setRoutePreview({
            distanceKm: Math.round((route.distance / 1000) * 10) / 10,
            durationMin: Math.round(route.duration / 60),
          });
        }
      } catch { /* ignore */ }
    }, 600);
    return () => { if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current); };
  }, [waypoints, avoidTolls, avoidHighways]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (waypoints.length < 2) {
      setError('Dodaj co najmniej 2 punkty trasy.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          isPublic,
          waypoints: waypoints.map((wp) => ({
            latitude: wp.latitude,
            longitude: wp.longitude,
            label: wp.label,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Nie udało się utworzyć trasy.');
        return;
      }

      setName('');
      setDescription('');
      setWaypoints([]);
      setIsPublic(false);
      onCreated?.();
    } catch {
      setError('Wystąpił nieoczekiwany błąd.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card-bg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-lg font-semibold text-foreground">Zaplanuj trasę</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-input-bg hover:text-foreground"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 pb-5">
          {/* Name */}
          <div>
            <label htmlFor="route-name" className="mb-1.5 block text-sm font-medium text-muted">
              Nazwa trasy
            </label>
            <input
              id="route-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Weekendowa przejażdżka"
              className="w-full rounded-xl border border-card-border bg-input-bg px-4 py-2.5 text-sm text-foreground placeholder-muted outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="route-desc" className="mb-1.5 block text-sm font-medium text-muted">
              Opis (opcjonalnie)
            </label>
            <textarea
              id="route-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Krótki opis trasy..."
              rows={2}
              className="w-full resize-none rounded-xl border border-card-border bg-input-bg px-4 py-2.5 text-sm text-foreground placeholder-muted outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {/* Waypoints */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-muted">
                Punkty trasy ({waypoints.length})
              </label>
              {userLocation && (
                <button
                  type="button"
                  onClick={addCurrentLocation}
                  className="text-[11px] font-medium text-orange-500 transition hover:text-orange-400"
                >
                  + Moja lokalizacja
                </button>
              )}
            </div>

            {/* Search input + map picker button */}
            <div className="relative mb-2 flex gap-2">
              <div className="relative flex-1">
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder="Szukaj miejsca..."
                  className="w-full rounded-xl border border-card-border bg-input-bg py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                />
                {searchLoading && (
                  <svg
                    className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-orange-500"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}

                {/* Search results dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-xl border border-card-border bg-card-bg shadow-xl">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => addWaypoint(result)}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-input-bg"
                      >
                        <svg className="h-4 w-4 shrink-0 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <span className="truncate text-foreground">{result.place_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Map picker button */}
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-card-border bg-input-bg text-muted transition hover:border-orange-500 hover:text-orange-500"
                title="Wybierz z mapy"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
                  <path d="M8 2v16" />
                  <path d="M16 6v16" />
                </svg>
              </button>
            </div>

            {/* Waypoint list */}
            {waypoints.length === 0 ? (
              <div className="rounded-xl border border-dashed border-card-border px-4 py-6 text-center">
                <svg
                  className="mx-auto mb-2 h-8 w-8 text-muted"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <p className="text-xs text-muted">Wyszukaj miejsca lub wybierz z mapy</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {waypoints.map((wp, index) => (
                  <li
                    key={wp.id}
                    className="flex items-center gap-2 rounded-xl bg-input-bg px-3 py-2"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                        index === 0 ? 'bg-emerald-600' : index === waypoints.length - 1 ? 'bg-red-500' : 'bg-orange-600'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="flex-1 truncate text-xs text-foreground">
                      {wp.label}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {/* Loop button — only on first waypoint when 2+ wps and not already a loop */}
                      {index === 0 && waypoints.length >= 2 && !isLoop && (
                        <button
                          type="button"
                          onClick={closeLoop}
                          title="Ustaw jako punkt końcowy (pętla)"
                          className="rounded p-1 text-muted transition hover:text-emerald-400"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                            <path d="M23 4v6h-6" />
                            <path d="M1 20v-6h6" />
                            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                          </svg>
                        </button>
                      )}
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => moveWaypoint(index, -1)}
                          className="rounded p-1 text-muted transition hover:text-foreground"
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                            <path d="M18 15l-6-6-6 6" />
                          </svg>
                        </button>
                      )}
                      {index < waypoints.length - 1 && (
                        <button
                          type="button"
                          onClick={() => moveWaypoint(index, 1)}
                          className="rounded p-1 text-muted transition hover:text-foreground"
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeWaypoint(wp.id)}
                        className="rounded p-1 text-muted transition hover:text-red-400"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Avoid options */}
          <div className="flex gap-2">
            <label className="flex flex-1 items-center gap-2.5 rounded-xl border border-card-border bg-input-bg px-3 py-2.5 cursor-pointer transition hover:border-orange-500/60">
              <input
                type="checkbox"
                checked={avoidTolls}
                onChange={(e) => setAvoidTolls(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-orange-500"
              />
              <div>
                <p className="text-xs font-semibold text-foreground">Unikaj płatnych dróg</p>
                <p className="text-[10px] text-muted mt-0.5">Bez autostrad płatnych</p>
              </div>
            </label>
            <label className="flex flex-1 items-center gap-2.5 rounded-xl border border-card-border bg-input-bg px-3 py-2.5 cursor-pointer transition hover:border-orange-500/60">
              <input
                type="checkbox"
                checked={avoidHighways}
                onChange={(e) => setAvoidHighways(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-orange-500"
              />
              <div>
                <p className="text-xs font-semibold text-foreground">Unikaj autostrad</p>
                <p className="text-[10px] text-muted mt-0.5">Trasy lokalne i krajowe</p>
              </div>
            </label>
          </div>

          {/* Public visibility */}
          <label className="flex items-start gap-3 rounded-xl border border-card-border bg-input-bg px-3 py-2.5 cursor-pointer transition hover:border-orange-500/60">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-orange-500"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">Udostępnij publicznie</p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted">
                Trasa pojawi się w <span className="text-foreground">Trasy → Publiczne</span> — inni kierowcy będą mogli ją pokazać na mapie i dodać do swoich.
              </p>
            </div>
          </label>

          {/* Route preview */}
          {routePreview && waypoints.length >= 2 && (
            <div className="flex items-center gap-4 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-orange-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4" />
                </svg>
                <span className="text-sm font-semibold">{routePreview.distanceKm} km</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                </svg>
                <span className="text-sm">
                  {routePreview.durationMin < 60
                    ? `${routePreview.durationMin} min`
                    : `${Math.floor(routePreview.durationMin / 60)} h ${routePreview.durationMin % 60} min`}
                </span>
              </div>
              <span className="ml-auto text-[10px] text-muted opacity-60">
                {avoidTolls || avoidHighways
                  ? [avoidTolls && 'bez płatnych', avoidHighways && 'bez autostrad'].filter(Boolean).join(', ')
                  : 'szacowany czas jazdy'}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-card-border bg-card-bg py-2.5 text-sm font-medium text-muted transition hover:bg-input-bg hover:text-foreground"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center rounded-xl bg-orange-600 py-2.5 text-sm font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                'Utwórz trasę'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Map waypoint picker */}
      <MapWaypointPicker
        open={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        existingWaypoints={waypoints}
        onPointPicked={(point) => {
          setWaypoints((prev) => [
            ...prev,
            {
              id: `wp-${Date.now()}-map-${Math.random().toString(36).slice(2, 6)}`,
              latitude: point.latitude,
              longitude: point.longitude,
              label: point.label.split(',')[0],
            },
          ]);
        }}
        onPointDeleted={(idx) => setWaypoints((prev) => prev.filter((_, i) => i !== idx))}
        onCloseLoop={closeLoop}
      />
    </div>
  );
}
