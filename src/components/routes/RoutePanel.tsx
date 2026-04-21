'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import CreateRouteModal from './CreateRouteModal';

interface RoutePanelProps {
  onShowOnMap?: () => void;
}

interface SavedRoute {
  id: string;
  name: string;
  description?: string;
  waypoints: string | { latitude: number; longitude: number; label?: string }[];
  createdAt: string;
}

interface SuggestedRoute {
  id: string;
  name: string;
  description: string;
  distance: number;
  duration: number;
  type: 'scenic' | 'mountain' | 'coastal' | 'city' | 'countryside';
  waypoints: { latitude: number; longitude: number; label?: string }[];
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  scenic: {
    label: 'Widokowa',
    color: 'text-emerald-400 bg-emerald-600/15',
    icon: 'M3 17l6-6 4 4 8-8',
  },
  mountain: {
    label: 'Górska',
    color: 'text-amber-400 bg-amber-600/15',
    icon: 'M12 2L2 22h20L12 2z',
  },
  coastal: {
    label: 'Nadmorska',
    color: 'text-blue-400 bg-blue-600/15',
    icon: 'M2 12c2-2 4-3 6-3s4 1 6 3 4 3 6 3 4-1 6-3',
  },
  city: {
    label: 'Miejska',
    color: 'text-violet-400 bg-violet-600/15',
    icon: 'M3 21h18M5 21V7l8-4v18M13 21V3l6 4v14',
  },
  countryside: {
    label: 'Wiejska',
    color: 'text-lime-400 bg-lime-600/15',
    icon: 'M12 22c-4-3-8-6-8-10a8 8 0 1116 0c0 4-4 7-8 10z',
  },
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

export default function RoutePanel({ onShowOnMap }: RoutePanelProps = {}) {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [suggested, setSuggested] = useState<SuggestedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestedLoading, setSuggestedLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [activeSection, setActiveSection] = useState<'suggested' | 'saved'>('suggested');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSuggestedId, setExpandedSuggestedId] = useState<string | null>(null);
  const [loadingMapId, setLoadingMapId] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<Record<string, { distance: number; duration: number } | null>>({});

  const userLocation = useMapStore((s) => s.userLocation);
  const { setRoutes: setMapRoutes, setMapFlyTarget, routes: mapRoutes, setNavigationRoute } = useMapStore();

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch('/api/routes');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRoutes(Array.isArray(data) ? data : data.routes ?? []);
    } catch {
      setError('Nie udało się załadować tras.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSuggested = useCallback(async () => {
    if (!userLocation) {
      setSuggestedLoading(false);
      return;
    }
    setSuggestedLoading(true);
    try {
      const res = await fetch(
        `/api/routes/suggested?lat=${userLocation.latitude}&lng=${userLocation.longitude}`
      );
      if (!res.ok) throw new Error();
      const data: SuggestedRoute[] = await res.json();
      setSuggested(data);
    } catch {
      // Silent — suggested routes are optional
    } finally {
      setSuggestedLoading(false);
    }
  }, [userLocation]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  useEffect(() => {
    fetchSuggested();
  }, [fetchSuggested]);

  async function deleteRoute(routeId: string) {
    if (!confirm('Czy na pewno chcesz usunąć tę trasę?')) return;
    try {
      const res = await fetch(`/api/routes?routeId=${routeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setRoutes((prev) => prev.filter((r) => r.id !== routeId));
    } catch {
      setError('Nie udało się usunąć trasy.');
    }
  }

  async function saveSuggestedRoute(route: SuggestedRoute) {
    setSavingId(route.id);
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: route.name,
          description: route.description,
          waypoints: route.waypoints.map((wp) => ({
            latitude: wp.latitude,
            longitude: wp.longitude,
            label: wp.label,
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await fetchRoutes();
      setActiveSection('saved');
    } catch (err) {
      setError(`Nie udało się zapisać trasy. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setSavingId(null);
    }
  }

  function getWaypointCount(route: SavedRoute): number {
    if (typeof route.waypoints === 'string') {
      try {
        return JSON.parse(route.waypoints).length;
      } catch {
        return 0;
      }
    }
    return route.waypoints?.length ?? 0;
  }

  function getParsedWaypoints(route: SavedRoute): { latitude: number; longitude: number; label?: string }[] {
    if (typeof route.waypoints === 'string') {
      try {
        return JSON.parse(route.waypoints);
      } catch {
        return [];
      }
    }
    return route.waypoints ?? [];
  }

  async function fetchRouteInfo(routeId: string, waypoints: { latitude: number; longitude: number }[]) {
    if (routeInfo[routeId] !== undefined || waypoints.length < 2) return;
    setRouteInfo((prev) => ({ ...prev, [routeId]: null })); // null = loading
    try {
      const coordStr = waypoints.map((wp) => `${wp.longitude},${wp.latitude}`).join(';');
      const res = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?overview=false&access_token=${MAPBOX_TOKEN}`
      );
      const data = await res.json();
      const leg = data.routes?.[0];
      if (leg) {
        setRouteInfo((prev) => ({
          ...prev,
          [routeId]: {
            distance: Math.round(leg.distance / 100) / 10,
            duration: Math.round(leg.duration / 60),
          },
        }));
      }
    } catch {
      // leave as null — no info available
    }
  }

  function fitToWaypoints(waypoints: { latitude: number; longitude: number }[]) {
    const lngs = waypoints.map((wp) => wp.longitude);
    const lats = waypoints.map((wp) => wp.latitude);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const longitude = (minLng + maxLng) / 2;
    const latitude = (minLat + maxLat) / 2;
    const maxDiff = Math.max(maxLng - minLng, maxLat - minLat);
    const zoom =
      maxDiff > 2 ? 7 :
      maxDiff > 1 ? 8 :
      maxDiff > 0.5 ? 9 :
      maxDiff > 0.2 ? 10 :
      maxDiff > 0.1 ? 11 :
      maxDiff > 0.05 ? 12 : 13;
    setMapFlyTarget({ longitude, latitude, zoom });
  }

  async function showRouteOnMap(id: string, name: string, waypoints: { latitude: number; longitude: number; label?: string }[]) {
    if (waypoints.length < 2) return;
    setLoadingMapId(id);
    try {
      const coordStr = waypoints.map((wp) => `${wp.longitude},${wp.latitude}`).join(';');
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      const leg = data.routes?.[0];
      const coordinates: [number, number][] = leg?.geometry?.coordinates ?? waypoints.map((wp) => [wp.longitude, wp.latitude]);
      const distance = leg ? Math.round(leg.distance / 1000) : 0;
      const duration = leg ? Math.round(leg.duration / 60) : 0;
      setMapRoutes([{ id, name, coordinates, waypoints, distance, duration, isActive: true }]);
      fitToWaypoints(waypoints);
    } catch {
      const coordinates: [number, number][] = waypoints.map((wp) => [wp.longitude, wp.latitude]);
      setMapRoutes([{ id, name, coordinates, waypoints, distance: 0, duration: 0, isActive: true }]);
      fitToWaypoints(waypoints);
    } finally {
      setLoadingMapId(null);
    }
    onShowOnMap?.();
  }

  function showOnMap(route: SavedRoute) {
    return showRouteOnMap(route.id, route.name, getParsedWaypoints(route));
  }

  function startNavigation(id: string, name: string, waypoints: { latitude: number; longitude: number; label?: string }[]) {
    if (waypoints.length < 2) return;
    setNavigationRoute({ id, name, waypoints });
    onShowOnMap?.();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Twoje trasy</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-orange-700"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Zaplanuj trasę
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-300 hover:text-red-200">✕</button>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1 rounded-xl bg-input-bg p-1">
        <button
          onClick={() => setActiveSection('suggested')}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
            activeSection === 'suggested'
              ? 'bg-card-bg text-foreground shadow-sm'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Proponowane
        </button>
        <button
          onClick={() => setActiveSection('saved')}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
            activeSection === 'saved'
              ? 'bg-card-bg text-foreground shadow-sm'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Zapisane ({routes.length})
        </button>
      </div>

      {/* === SUGGESTED ROUTES === */}
      {activeSection === 'suggested' && (
        <>
          {suggestedLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="h-6 w-6 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : !userLocation ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-card-border bg-card-bg py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600/15 text-orange-500">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Lokalizacja niedostępna</p>
                <p className="mt-0.5 text-xs text-muted">Włącz lokalizację, aby zobaczyć proponowane trasy</p>
              </div>
            </div>
          ) : suggested.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-card-border bg-card-bg py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600/15 text-orange-500">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="6" cy="19" r="3" />
                  <path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15" />
                  <circle cx="18" cy="5" r="3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Brak sugestii</p>
                <p className="mt-0.5 text-xs text-muted">Nie znaleziono tras w Twojej okolicy</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted">
                Trasy w pobliżu Twojej lokalizacji
              </p>
              {suggested.map((route) => {
                const cfg = TYPE_CONFIG[route.type] ?? TYPE_CONFIG.scenic;
                const isExpanded = expandedSuggestedId === route.id;
                return (
                  <div
                    key={route.id}
                    className="overflow-hidden rounded-2xl border border-card-border bg-card-bg"
                  >
                    {/* Header — kliknięcie rozwija podgląd */}
                    <button
                      onClick={() => setExpandedSuggestedId(isExpanded ? null : route.id)}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.color}`}>
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d={cfg.icon} />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{route.name}</p>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">{route.description}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                            </svg>
                            {route.distance} km
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                            </svg>
                            {formatDuration(route.duration)}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            {route.waypoints.length} pkt
                          </span>
                        </div>
                      </div>
                      <svg
                        className={`mt-1 h-4 w-4 shrink-0 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {/* Rozwinięty podgląd */}
                    {isExpanded && (
                      <div className="border-t border-card-border px-4 pb-3.5 pt-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Punkty trasy</p>
                        <ol className="flex flex-col gap-1.5">
                          {route.waypoints.map((wp, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <span
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                                  idx === 0 ? 'bg-emerald-500' : idx === route.waypoints.length - 1 ? 'bg-red-500' : 'bg-orange-500'
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <span className="text-xs text-foreground leading-5">
                                {wp.label ?? `${wp.latitude.toFixed(5)}, ${wp.longitude.toFixed(5)}`}
                              </span>
                            </li>
                          ))}
                        </ol>
                        <div className="mt-3 flex flex-col gap-2">
                          <button
                            onClick={() => startNavigation(route.id, route.name, route.waypoints)}
                            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                              <polygon points="3 11 22 2 13 21 11 13 3 11" />
                            </svg>
                            Nawiguj
                          </button>
                          <div className="flex gap-2">
                            {onShowOnMap && (
                              <button
                                onClick={() => showRouteOnMap(route.id, route.name, route.waypoints)}
                                disabled={loadingMapId === route.id}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                              >
                                {loadingMapId === route.id ? (
                                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <>
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                      <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
                                      <path d="M8 2v16M16 6v16" />
                                    </svg>
                                    Pokaż na mapie
                                  </>
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => saveSuggestedRoute(route)}
                              disabled={savingId === route.id}
                              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-600 py-2.5 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
                            >
                              {savingId === route.id ? (
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                <>
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                                    <path d="M17 21v-8H7v8M7 3v5h8" />
                                  </svg>
                                  Zapisz trasę
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                onClick={fetchSuggested}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-card-border bg-card-bg py-2.5 text-xs font-semibold text-muted transition hover:bg-input-bg hover:text-foreground"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                </svg>
                Odśwież propozycje
              </button>
            </div>
          )}
        </>
      )}

      {/* === SAVED ROUTES === */}
      {activeSection === 'saved' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="h-6 w-6 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : routes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-card-border bg-card-bg py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600/15 text-orange-500">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="6" cy="19" r="3" />
                  <path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15" />
                  <circle cx="18" cy="5" r="3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Brak zapisanych tras</p>
                <p className="mt-0.5 text-xs text-muted">Zaplanuj trasę lub zapisz proponowaną!</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {routes.map((route) => {
                const wpCount = getWaypointCount(route);
                const isExpanded = expandedId === route.id;
                const waypoints = isExpanded ? getParsedWaypoints(route) : [];
                const info = routeInfo[route.id];
                return (
                  <div
                    key={route.id}
                    className="overflow-hidden rounded-2xl border border-card-border bg-card-bg"
                  >
                    {/* Route header row */}
                    <button
                      onClick={() => {
                        const next = isExpanded ? null : route.id;
                        setExpandedId(next);
                        if (next) fetchRouteInfo(next, getParsedWaypoints(route));
                      }}
                      className="flex w-full items-start justify-between gap-2 px-4 py-3.5 text-left"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600/15 text-orange-500">
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <circle cx="6" cy="19" r="3" />
                            <path d="M9 19h8.5a3.5 3.5 0 000-7h-11a3.5 3.5 0 010-7H15" />
                            <circle cx="18" cy="5" r="3" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{route.name}</p>
                          {route.description && (
                            <p className="mt-0.5 truncate text-xs text-muted">{route.description}</p>
                          )}
                          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted">
                            <span className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                              {wpCount} {wpCount === 1 ? 'punkt' : 'punktów'}
                            </span>
                            <span>
                              {new Date(route.createdAt).toLocaleDateString('pl-PL')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <svg
                          className={`h-4 w-4 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded preview */}
                    {isExpanded && (
                      <div className="border-t border-card-border px-4 pb-3.5 pt-3">
                        {/* Distance / duration */}
                        <div className="mb-3 flex items-center gap-3">
                          {info === null ? (
                            <svg className="h-3.5 w-3.5 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : info ? (
                            <>
                              <span className="flex items-center gap-1 text-xs text-foreground font-medium">
                                <svg className="h-3.5 w-3.5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                  <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                                </svg>
                                {info.distance} km
                              </span>
                              <span className="flex items-center gap-1 text-xs text-foreground font-medium">
                                <svg className="h-3.5 w-3.5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                                </svg>
                                {formatDuration(info.duration)}
                              </span>
                            </>
                          ) : null}
                        </div>
                        {/* Waypoints list */}
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Punkty trasy</p>
                        <ol className="flex flex-col gap-1.5">
                          {waypoints.map((wp, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <span
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                                  idx === 0
                                    ? 'bg-emerald-500'
                                    : idx === waypoints.length - 1
                                    ? 'bg-red-500'
                                    : 'bg-orange-500'
                                }`}
                              >
                                {idx + 1}
                              </span>
                              <span className="text-xs text-foreground leading-5">
                                {wp.label ?? `${wp.latitude.toFixed(5)}, ${wp.longitude.toFixed(5)}`}
                              </span>
                            </li>
                          ))}
                        </ol>

                        {/* Action buttons */}
                        <div className="mt-3 flex flex-col gap-2">
                          {wpCount >= 2 && (
                            <button
                              onClick={() => startNavigation(route.id, route.name, getParsedWaypoints(route))}
                              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                <polygon points="3 11 22 2 13 21 11 13 3 11" />
                              </svg>
                              Nawiguj
                            </button>
                          )}
                          <div className="flex gap-2">
                            {onShowOnMap && wpCount >= 2 && (
                              <button
                                onClick={() => showOnMap(route)}
                                disabled={loadingMapId === route.id}
                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                              >
                                {loadingMapId === route.id ? (
                                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <>
                                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                      <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" />
                                      <path d="M8 2v16" />
                                      <path d="M16 6v16" />
                                    </svg>
                                    Pokaż na mapie
                                  </>
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => deleteRoute(route.id)}
                              className="flex items-center justify-center gap-1.5 rounded-xl border border-card-border px-3 py-2.5 text-xs font-semibold text-muted transition hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                              Usuń
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create route modal */}
      <CreateRouteModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchRoutes();
          setActiveSection('saved');
        }}
      />
    </div>
  );
}
