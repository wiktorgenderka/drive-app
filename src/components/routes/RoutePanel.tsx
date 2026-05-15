'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useMapStore } from '@/stores/useMapStore';
import { haversineMeters } from '@/lib/geo';
import CreateRouteModal from './CreateRouteModal';
import RouteCollectionsPanel from './RouteCollectionsPanel';
import { MiniProfileModal, type MiniProfileUser, type MiniProfileContext } from '@/components/profile/PublicProfileModals';
import type { RouteTime } from '@/types';

interface LeaderboardEntry {
  userId: string;
  seconds: number;
  attempts: number;
  user: { id: string; name: string; image: string | null; carDisplay: string | null };
}

// Auto-finish: kiedy użytkownik wejdzie w promień ostatniego waypointa, timer jest automatycznie zatrzymywany.
// MIN_START_DISPLACEMENT_M zapobiega natychmiastowemu wyzwoleniu, gdy start i meta są blisko siebie.
const FINISH_RADIUS_M = 40;
const MIN_START_DISPLACEMENT_M = 100;

interface RoutePanelProps {
  onShowOnMap?: () => void;
  onShowProfile?: (userId: string) => void;
  onCreateRouteOpenChange?: (open: boolean) => void;
}

interface SavedRoute {
  id: string;
  name: string;
  description?: string;
  waypoints: string | { latitude: number; longitude: number; label?: string }[];
  createdAt: string;
  isPublic?: boolean;
  publishedAt?: string | null;
}

interface PublicRoute {
  id: string;
  name: string;
  description?: string | null;
  waypoints: string | { latitude: number; longitude: number; label?: string }[];
  publishedAt: string | null;
  createdAt: string;
  userId: string;
  user: { id: string; name: string; image: string | null };
  _count?: { times: number; imports: number };
  avgRating?: number | null;
  ratingCount?: number;
  myStars?: number | null;
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

function formatTime(seconds: number): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTimeMs(seconds: number): string {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const cs = Math.floor((total - Math.floor(total)) * 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

const MEDAL_COLORS = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];

export default function RoutePanel({ onShowOnMap, onShowProfile, onCreateRouteOpenChange }: RoutePanelProps = {}) {
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [suggested, setSuggested] = useState<SuggestedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestedLoading, setSuggestedLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [activeSection, setActiveSection] = useState<'suggested' | 'community' | 'saved' | 'collections'>('suggested');

  useEffect(() => {
    onCreateRouteOpenChange?.(showCreate);
  }, [showCreate, onCreateRouteOpenChange]);

  // Community (public) routes
  const [publicRoutes, setPublicRoutes] = useState<PublicRoute[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicLoaded, setPublicLoaded] = useState(false);
  const [publicQuery, setPublicQuery] = useState('');
  const [publicSort, setPublicSort] = useState<'top' | 'new'>('top');
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [expandedPublicId, setExpandedPublicId] = useState<string | null>(null);
  const [togglingPublicId, setTogglingPublicId] = useState<string | null>(null);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [leaderboards, setLeaderboards] = useState<Record<string, LeaderboardEntry[]>>({});
  const [leaderboardsLoading, setLeaderboardsLoading] = useState<Record<string, boolean>>({});
  const [miniProfile, setMiniProfile] = useState<{ user: MiniProfileUser; context: MiniProfileContext } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedSuggestedId, setExpandedSuggestedId] = useState<string | null>(null);
  const [nfsStartMode, setNfsStartMode] = useState<'countdown' | 'checkpoint'>('countdown');
  const [loadingMapId, setLoadingMapId] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<Record<string, { distance: number; duration: number } | null>>({});

  // Challenge timer
  const [timerRouteId, setTimerRouteId] = useState<string | null>(null);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hasLeftStart, setHasLeftStart] = useState(false);
  const [savingTime, setSavingTime] = useState(false);
  const [scores, setScores] = useState<Record<string, RouteTime[]>>({});
  const [scoresLoading, setScoresLoading] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppingRef = useRef(false);
  const gpxInputRef = useRef<HTMLInputElement | null>(null);
  const [gpxImporting, setGpxImporting] = useState(false);
  const [gpxError, setGpxError] = useState('');
  const [toast, setToast] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(''), 2500);
  }

  const { data: session } = useSession();
  const userLocation = useMapStore((s) => s.userLocation);
  const { setRoutes: setMapRoutes, setMapFlyTarget, routes: mapRoutes, setNavigationRoute, startMysteryDrive } = useMapStore();

  async function startMysteryRun(id: string, name: string, waypoints: { latitude: number; longitude: number; label?: string }[]) {
    if (waypoints.length < 2) return;
    // Pobierz road-snapped coordinates i wstaw do store zanim segmenty będą renderowane.
    try {
      const coordStr = waypoints.map((wp) => `${wp.longitude},${wp.latitude}`).join(';');
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      const leg = data.routes?.[0];
      const coordinates: [number, number][] = leg?.geometry?.coordinates ?? waypoints.map((wp) => [wp.longitude, wp.latitude]);
      setMapRoutes([{ id, name, coordinates, waypoints, distance: leg ? Math.round(leg.distance / 1000) : 0, duration: leg ? Math.round(leg.duration / 60) : 0, isActive: true }]);
    } catch {
      setMapRoutes([{ id, name, coordinates: waypoints.map((wp) => [wp.longitude, wp.latitude] as [number, number]), waypoints, distance: 0, duration: 0, isActive: true }]);
    }
    startMysteryDrive({ routeId: id, routeName: name, waypoints, startMode: nfsStartMode });
    onShowOnMap?.();
  }

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const fetchRoutes = useCallback(async () => {
    try {
      const res = await fetch('/api/routes');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRoutes(Array.isArray(data) ? data : data.data ?? []);
    } catch {
      setError('Nie udało się załadować tras.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPublicRoutes = useCallback(async (query = '', sort: 'top' | 'new' = 'top') => {
    setPublicLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      params.set('sort', sort);
      const res = await fetch(`/api/routes/public?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPublicRoutes(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      setError(`Nie udało się załadować tras społeczności. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setPublicLoading(false);
      setPublicLoaded(true);
    }
  }, []);

  const ratePublic = useCallback(async (routeId: string, stars: number | null) => {
    setRatingId(routeId);
    try {
      const res = stars === null
        ? await fetch(`/api/routes/${routeId}/ratings`, { method: 'DELETE' })
        : await fetch(`/api/routes/${routeId}/ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stars }),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const updated = await res.json();
      setPublicRoutes((prev) =>
        prev.map((r) =>
          r.id === routeId
            ? {
                ...r,
                avgRating: updated.avgRating ?? null,
                ratingCount: updated.ratingCount ?? 0,
                myStars: updated.myStars ?? null,
              }
            : r
        )
      );
    } catch (err) {
      setError(`Nie udało się zapisać oceny. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setRatingId(null);
    }
  }, []);

  const togglePublic = useCallback(async (routeId: string, next: boolean) => {
    setTogglingPublicId(routeId);
    try {
      const res = await fetch(`/api/routes/${routeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = typeof body?.error === 'string' ? body.error : `HTTP ${res.status}`;
        throw new Error(msg);
      }
      const updated = await res.json();
      setRoutes((prev) =>
        prev.map((r) => (r.id === routeId ? { ...r, isPublic: updated.isPublic, publishedAt: updated.publishedAt } : r))
      );
    } catch (err) {
      setError(`Nie udało się zmienić widoczności trasy. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setTogglingPublicId(null);
    }
  }, []);

  const fetchLeaderboard = useCallback(async (routeId: string) => {
    setLeaderboardsLoading((p) => ({ ...p, [routeId]: true }));
    try {
      const res = await fetch(`/api/routes/${routeId}/leaderboard`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLeaderboards((p) => ({ ...p, [routeId]: Array.isArray(data?.entries) ? data.entries : [] }));
    } catch {
      setLeaderboards((p) => ({ ...p, [routeId]: [] }));
    } finally {
      setLeaderboardsLoading((p) => ({ ...p, [routeId]: false }));
    }
  }, []);

  const importPublicRoute = useCallback(async (routeId: string) => {
    setImportingId(routeId);
    try {
      const res = await fetch(`/api/routes/public/${routeId}/import`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      await fetchRoutes();
      setActiveSection('saved');
    } catch (err) {
      setError(`Nie udało się dodać trasy. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setImportingId(null);
    }
  }, [fetchRoutes]);

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

  useEffect(() => {
    if (activeSection === 'community' && !publicLoaded && !publicLoading) {
      fetchPublicRoutes(publicQuery, publicSort);
    }
  }, [activeSection, publicLoaded, publicLoading, publicQuery, publicSort, fetchPublicRoutes]);

  useEffect(() => {
    if (timerStart !== null) {
      timerRef.current = setInterval(() => {
        setTimerElapsed((Date.now() - timerStart) / 1000);
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimerElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerStart]);

  // Countdown 5→1 przed faktycznym startem timera.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      setHasLeftStart(false);
      setTimerStart(Date.now());
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const fetchScores = useCallback(async (routeId: string) => {
    setScoresLoading((prev) => ({ ...prev, [routeId]: true }));
    try {
      const res = await fetch(`/api/routes/${routeId}/times`);
      if (!res.ok) throw new Error();
      const data: RouteTime[] = await res.json();
      setScores((prev) => ({ ...prev, [routeId]: data }));
    } catch {
      // silent
    } finally {
      setScoresLoading((prev) => ({ ...prev, [routeId]: false }));
    }
  }, []);

  const startTimer = useCallback((routeId: string) => {
    stoppingRef.current = false;
    setTimerRouteId(routeId);
    setTimerElapsed(0);
    setHasLeftStart(false);
    setCountdown(5);
  }, []);

  const cancelChallenge = useCallback(() => {
    stoppingRef.current = false;
    setCountdown(null);
    setTimerStart(null);
    setTimerRouteId(null);
    setHasLeftStart(false);
  }, []);

  const finishTimer = useCallback(async (routeId: string, startedAt: number) => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const elapsedMs = Date.now() - startedAt;
    const seconds = Math.max(1, Math.round(elapsedMs / 1000));
    setTimerStart(null);
    setTimerRouteId(null);
    setHasLeftStart(false);
    setSavingTime(true);
    try {
      await fetch(`/api/routes/${routeId}/times`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds }),
      });
      await fetchScores(routeId);
    } catch {
      setError('Nie udało się zapisać czasu.');
    } finally {
      setSavingTime(false);
      stoppingRef.current = false;
    }
  }, [fetchScores]);

  // Auto-stop: obserwuj GPS i kończ wyzwanie automatycznie po dotarciu do ostatniego waypointa.
  useEffect(() => {
    if (timerStart === null || !timerRouteId || !userLocation) return;
    const route = routes.find((r) => r.id === timerRouteId);
    if (!route) return;
    const waypoints = getParsedWaypoints(route);
    if (waypoints.length < 2) return;

    const first = waypoints[0];
    const last = waypoints[waypoints.length - 1];
    const distFromStart = haversineMeters(
      userLocation.latitude, userLocation.longitude,
      first.latitude, first.longitude
    );
    const distToFinish = haversineMeters(
      userLocation.latitude, userLocation.longitude,
      last.latitude, last.longitude
    );

    if (!hasLeftStart && distFromStart >= MIN_START_DISPLACEMENT_M) {
      setHasLeftStart(true);
    }
    if ((hasLeftStart || distFromStart >= MIN_START_DISPLACEMENT_M) && distToFinish <= FINISH_RADIUS_M) {
      finishTimer(timerRouteId, timerStart);
    }
  }, [userLocation, timerStart, timerRouteId, routes, hasLeftStart, finishTimer]);

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

  async function handleGpxImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setGpxImporting(true);
    setGpxError('');
    try {
      const text = await file.text();
      const res = await fetch('/api/routes/import-gpx', {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: text,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Błąd importu');
      }
      const created = await res.json();
      const fetched = await fetch('/api/routes');
      if (fetched.ok) {
        const data = await fetched.json();
        setRoutes(Array.isArray(data) ? data : data.routes ?? []);
      }
      setActiveSection('saved');
      setExpandedId(created.id);
    } catch (err) {
      setGpxError(err instanceof Error ? err.message : 'Błąd importu GPX');
    } finally {
      setGpxImporting(false);
      if (gpxInputRef.current) gpxInputRef.current.value = '';
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
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Twoje trasy</h2>
        <div className="flex items-center gap-2">
          <input ref={gpxInputRef} type="file" accept=".gpx,application/gpx+xml,text/xml" className="hidden" onChange={handleGpxImport} />
          <button
            onClick={() => gpxInputRef.current?.click()}
            disabled={gpxImporting}
            className="flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-card-bg hover:text-foreground disabled:opacity-50"
            title="Importuj GPX"
          >
            {gpxImporting ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            ) : (
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V10m0 0l-3 3m3-3l3 3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" /></svg>
            )}
            GPX
          </button>
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
      </div>
      {gpxError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {gpxError}
        </div>
      )}

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
          onClick={() => setActiveSection('community')}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
            activeSection === 'community'
              ? 'bg-card-bg text-foreground shadow-sm'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Publiczne
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
        <button
          onClick={() => setActiveSection('collections')}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
            activeSection === 'collections'
              ? 'bg-card-bg text-foreground shadow-sm'
              : 'text-muted hover:text-foreground'
          }`}
        >
          Kolekcje
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

      {/* === COMMUNITY (PUBLIC) ROUTES === */}
      {activeSection === 'community' && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={publicQuery}
                onChange={(e) => setPublicQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchPublicRoutes(publicQuery, publicSort); }}
                placeholder="Szukaj publicznych tras..."
                className="w-full rounded-xl border border-card-border bg-input-bg py-2 pl-10 pr-4 text-sm text-foreground placeholder-muted outline-none transition focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <button
              onClick={() => fetchPublicRoutes(publicQuery, publicSort)}
              className="flex items-center justify-center rounded-xl border border-card-border bg-card-bg px-3 py-2 text-xs font-semibold text-muted transition hover:bg-input-bg hover:text-foreground"
              title="Odśwież"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
              </svg>
            </button>
          </div>

          {/* Sort toggle */}
          <div className="flex gap-1 rounded-xl bg-input-bg p-1">
            <button
              onClick={() => { setPublicSort('top'); fetchPublicRoutes(publicQuery, 'top'); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                publicSort === 'top' ? 'bg-card-bg text-foreground shadow-sm' : 'text-muted hover:text-foreground'
              }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
              </svg>
              Najlepsze
            </button>
            <button
              onClick={() => { setPublicSort('new'); fetchPublicRoutes(publicQuery, 'new'); }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                publicSort === 'new' ? 'bg-card-bg text-foreground shadow-sm' : 'text-muted hover:text-foreground'
              }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Nowe
            </button>
          </div>

          {/* Near me filter */}
          {userLocation && (
            <button
              onClick={() => setNearbyOnly((v) => !v)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                nearbyOnly
                  ? 'border-orange-500/50 bg-orange-500/10 text-orange-400'
                  : 'border-card-border bg-card-bg text-muted hover:text-foreground'
              }`}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Blisko mnie (20 km)
            </button>
          )}

          {publicLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="h-6 w-6 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (() => {
            const NEARBY_KM = 20;
            const filteredPublic = nearbyOnly && userLocation
              ? publicRoutes.filter((r) => {
                  const wps: { latitude: number; longitude: number }[] =
                    typeof r.waypoints === 'string'
                      ? (() => { try { return JSON.parse(r.waypoints as string); } catch { return []; } })()
                      : (r.waypoints ?? []);
                  if (wps.length === 0) return false;
                  const first = wps[0];
                  const dLat = (first.latitude - userLocation.latitude) * 111320;
                  const dLng = (first.longitude - userLocation.longitude) * 111320 * Math.cos(userLocation.latitude * (Math.PI / 180));
                  return Math.sqrt(dLat * dLat + dLng * dLng) / 1000 <= NEARBY_KM;
                })
              : publicRoutes;
            return filteredPublic.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-card-border bg-card-bg py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600/15 text-orange-500">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Brak publicznych tras</p>
                <p className="mt-0.5 text-xs text-muted">{nearbyOnly ? 'Brak tras w pobliżu (20 km). Wyłącz filtr "Blisko mnie".' : 'Bądź pierwszym, który udostępni swoją trasę społeczności!'}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredPublic.map((route) => {
                const wps: { latitude: number; longitude: number; label?: string }[] =
                  typeof route.waypoints === 'string'
                    ? (() => { try { return JSON.parse(route.waypoints as string); } catch { return []; } })()
                    : (route.waypoints ?? []);
                const wpCount = wps.length;
                const isExpanded = expandedPublicId === route.id;
                const when = route.publishedAt ? new Date(route.publishedAt) : new Date(route.createdAt);
                return (
                  <div
                    key={route.id}
                    className="overflow-hidden rounded-2xl border border-card-border bg-card-bg"
                  >
                    <button
                      onClick={() => {
                        const next = isExpanded ? null : route.id;
                        setExpandedPublicId(next);
                        if (next && !leaderboards[next] && !leaderboardsLoading[next]) {
                          fetchLeaderboard(next);
                        }
                      }}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600/15 text-indigo-400">
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="10" />
                          <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{route.name}</p>
                        {route.description && (
                          <p className="mt-0.5 truncate text-xs text-muted">{route.description}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                            {route.user?.name ?? 'Użytkownik'}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            {wpCount} pkt
                          </span>
                          {route._count?.times !== undefined && (
                            <span className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                              </svg>
                              {route._count.times}
                            </span>
                          )}
                          {typeof route.ratingCount === 'number' && route.ratingCount > 0 ? (
                            <span className="flex items-center gap-1 rounded-md bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                              </svg>
                              {(route.avgRating ?? 0).toFixed(1)} ({route.ratingCount})
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted">Brak ocen</span>
                          )}
                          <span>{when.toLocaleDateString('pl-PL')}</span>
                        </div>
                      </div>
                      <svg
                        className={`mt-1 h-4 w-4 shrink-0 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-card-border px-4 pb-3.5 pt-3">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Punkty trasy</p>
                        <ol className="flex flex-col gap-1.5">
                          {wps.map((wp, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <span
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                                  idx === 0 ? 'bg-emerald-500' : idx === wps.length - 1 ? 'bg-red-500' : 'bg-orange-500'
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
                        <div className="mt-3 flex gap-2">
                          {onShowOnMap && wpCount >= 2 && (
                            <button
                              onClick={() => showRouteOnMap(route.id, route.name, wps)}
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
                            onClick={() => importPublicRoute(route.id)}
                            disabled={importingId === route.id}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-600 py-2.5 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
                          >
                            {importingId === route.id ? (
                              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                  <path d="M12 5v14M5 12h14" />
                                </svg>
                                Dodaj do moich
                              </>
                            )}
                          </button>
                        </div>

                        {wpCount >= 2 && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            <div className="flex overflow-hidden rounded-lg border border-rose-500/30 bg-black/20">
                              <button
                                onClick={() => setNfsStartMode('countdown')}
                                className={`flex flex-1 items-center justify-center gap-1 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${nfsStartMode === 'countdown' ? 'bg-rose-600 text-white' : 'text-white/50 hover:text-white/80'}`}
                              >
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                Odliczanie
                              </button>
                              <button
                                onClick={() => setNfsStartMode('checkpoint')}
                                className={`flex flex-1 items-center justify-center gap-1 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${nfsStartMode === 'checkpoint' ? 'bg-rose-600 text-white' : 'text-white/50 hover:text-white/80'}`}
                              >
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                                PKT 1
                              </button>
                            </div>
                            <button
                              onClick={() => startMysteryRun(route.id, route.name, wps)}
                              disabled={!userLocation}
                              title={userLocation ? 'Tryb tajemniczy — checkpointy odsłaniają się w trakcie jazdy' : 'Wymaga GPS'}
                              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-orange-600 to-amber-500 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2 12l5-9 5 5 5-9 5 13H2z" />
                              </svg>
                              Tryb NFS
                            </button>
                          </div>
                        )}

                        {/* Top 5 leaderboard */}
                        <div className="mt-4 border-t border-card-border pt-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Top 5 czasów</p>
                            <button
                              onClick={() => fetchLeaderboard(route.id)}
                              className="text-[10px] text-muted hover:text-foreground transition"
                            >
                              Odśwież
                            </button>
                          </div>
                          {leaderboardsLoading[route.id] ? (
                            <div className="flex justify-center py-3">
                              <svg className="h-4 w-4 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            </div>
                          ) : !leaderboards[route.id] || leaderboards[route.id].length === 0 ? (
                            <p className="text-center text-xs text-muted py-3">Brak wyników — bądź pierwszy!</p>
                          ) : (
                            <ol className="flex flex-col gap-1.5">
                              {leaderboards[route.id].map((entry, idx) => (
                                <li key={entry.userId}>
                                  <button
                                    onClick={() =>
                                      setMiniProfile({
                                        user: entry.user,
                                        context: { routeName: route.name, seconds: entry.seconds, position: idx + 1 },
                                      })
                                    }
                                    className="flex w-full items-center gap-2.5 rounded-xl bg-input-bg px-3 py-2 text-left transition hover:bg-card-bg"
                                  >
                                    <span className={`w-5 text-center text-sm font-bold ${MEDAL_COLORS[idx] ?? 'text-muted'}`}>
                                      {idx < 3 ? ['🥇','🥈','🥉'][idx] : `${idx + 1}.`}
                                    </span>
                                    <div className="flex h-7 w-7 shrink-0 overflow-hidden rounded-full bg-card-bg">
                                      {entry.user.image ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={entry.user.image} alt={entry.user.name} className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-muted">
                                          {entry.user.name?.[0]?.toUpperCase() ?? '?'}
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-xs font-semibold text-foreground">{entry.user.name}</p>
                                      {entry.user.carDisplay && (
                                        <p className="truncate text-[10px] text-muted">{entry.user.carDisplay}</p>
                                      )}
                                    </div>
                                    <span className="font-mono text-xs font-bold text-orange-400 tabular-nums">
                                      {formatTime(entry.seconds)}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>

                        {/* Ratings */}
                        <div className="mt-4 border-t border-card-border pt-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-foreground">
                                {route.userId === session?.user?.id ? 'Oceny tej trasy' : 'Oceń trasę'}
                              </p>
                              <p className="mt-0.5 text-[11px] leading-4 text-muted">
                                {route.ratingCount && route.ratingCount > 0
                                  ? `Średnia ${(route.avgRating ?? 0).toFixed(2)} z ${route.ratingCount} ${route.ratingCount === 1 ? 'oceny' : 'ocen'}`
                                  : 'Jeszcze nikt nie ocenił — bądź pierwszy!'}
                              </p>
                            </div>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((n) => {
                                const filled = (route.myStars ?? 0) >= n;
                                const isOwn = route.userId === session?.user?.id;
                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    disabled={isOwn || ratingId === route.id}
                                    onClick={() => ratePublic(route.id, route.myStars === n ? null : n)}
                                    title={isOwn ? 'Nie możesz ocenić własnej trasy' : filled ? `${n}/5 — kliknij by cofnąć` : `Oceń ${n}/5`}
                                    className={`p-0.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                      filled ? 'text-yellow-400' : 'text-muted hover:text-yellow-400'
                                    }`}
                                  >
                                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
                                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
                                    </svg>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
          })()}
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
                        if (next) {
                          fetchRouteInfo(next, getParsedWaypoints(route));
                          if (!scores[next]) fetchScores(next);
                        }
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
                            {route.isPublic && (
                              <span className="flex items-center gap-1 rounded-md bg-orange-600/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-400">
                                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                  <circle cx="12" cy="12" r="10" />
                                  <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
                                </svg>
                                Publiczna
                              </span>
                            )}
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
                          {wpCount >= 2 && (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex overflow-hidden rounded-lg border border-rose-500/30 bg-black/20">
                                <button
                                  onClick={() => setNfsStartMode('countdown')}
                                  className={`flex flex-1 items-center justify-center gap-1 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${nfsStartMode === 'countdown' ? 'bg-rose-600 text-white' : 'text-white/50 hover:text-white/80'}`}
                                >
                                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                  Odliczanie
                                </button>
                                <button
                                  onClick={() => setNfsStartMode('checkpoint')}
                                  className={`flex flex-1 items-center justify-center gap-1 py-1.5 text-[10px] font-bold uppercase tracking-wide transition ${nfsStartMode === 'checkpoint' ? 'bg-rose-600 text-white' : 'text-white/50 hover:text-white/80'}`}
                                >
                                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M2 12h4M18 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                                  PKT 1
                                </button>
                              </div>
                              <button
                                onClick={() => startMysteryRun(route.id, route.name, getParsedWaypoints(route))}
                                disabled={!userLocation}
                                title={userLocation ? 'Tryb tajemniczy — checkpointy odsłaniają się w trakcie jazdy' : 'Wymaga GPS'}
                                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-orange-600 to-amber-500 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M2 12l5-9 5 5 5-9 5 13H2z" />
                                </svg>
                                Tryb NFS
                              </button>
                            </div>
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
                            <a
                              href={`/api/routes/${route.id}/gpx`}
                              download
                              className="flex items-center justify-center gap-1.5 rounded-xl border border-card-border px-3 py-2.5 text-xs font-semibold text-muted transition hover:bg-green-500/10 hover:text-green-400 hover:border-green-500/30"
                              title="Pobierz GPX"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a1 1 0 001 1h16a1 1 0 001-1v-3" />
                              </svg>
                              GPX
                            </a>
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/routes/${route.id}/share-link`, { method: 'POST' });
                                  if (res.ok) {
                                    const { url } = await res.json();
                                    await navigator.clipboard.writeText(url);
                                    showToast('Link skopiowany!');
                                  }
                                } catch { showToast('Błąd kopiowania linku'); }
                              }}
                              className="flex items-center justify-center gap-1.5 rounded-xl border border-card-border px-3 py-2.5 text-xs font-semibold text-muted transition hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30"
                              title="Kopiuj link do trasy"
                            >
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                              </svg>
                              Link
                            </button>
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

                        {/* Publish toggle */}
                        <div className="mt-4 border-t border-card-border pt-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-foreground">Publiczna trasa</p>
                              <p className="mt-0.5 text-[11px] leading-4 text-muted">
                                {route.isPublic
                                  ? 'Inni kierowcy widzą ją w sekcji Trasy → Publiczne.'
                                  : 'Opublikuj, aby inni mogli ją zobaczyć i dodać do swoich.'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => togglePublic(route.id, !route.isPublic)}
                              disabled={togglingPublicId === route.id}
                              aria-pressed={!!route.isPublic}
                              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
                                route.isPublic ? 'bg-orange-600' : 'bg-input-bg border border-card-border'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                                  route.isPublic ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Challenge timer */}
                        <div className="mt-4 border-t border-card-border pt-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Wyzwanie czasowe</p>
                          {timerRouteId === route.id && countdown !== null ? (
                            <div className="flex flex-col items-center gap-2 rounded-xl bg-orange-600/10 px-3 py-5">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400">Gotów? Start za…</p>
                              <span className="font-mono text-5xl font-black text-orange-400 tabular-nums">
                                {countdown}
                              </span>
                              <button
                                onClick={cancelChallenge}
                                className="mt-1 text-[11px] font-medium text-muted hover:text-foreground transition"
                              >
                                Anuluj
                              </button>
                            </div>
                          ) : timerRouteId === route.id && timerStart !== null ? (
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-3">
                                <div className="flex flex-1 items-center gap-2 rounded-xl bg-orange-600/10 px-3 py-2.5">
                                  <svg className="h-4 w-4 animate-pulse text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                                  </svg>
                                  <span className="font-mono text-sm font-bold text-orange-400 tabular-nums">
                                    {formatTimeMs(timerElapsed)}
                                  </span>
                                </div>
                                <button
                                  onClick={cancelChallenge}
                                  disabled={savingTime}
                                  className="flex items-center gap-1.5 rounded-xl border border-card-border px-3 py-2.5 text-xs font-semibold text-muted transition hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 disabled:opacity-50"
                                >
                                  Przerwij
                                </button>
                              </div>
                              {(() => {
                                const wps = getParsedWaypoints(route);
                                if (wps.length < 2 || !userLocation) {
                                  return (
                                    <p className="text-[11px] text-muted">
                                      {userLocation ? 'Brak ostatniego punktu trasy.' : 'Czekam na sygnał GPS…'}
                                    </p>
                                  );
                                }
                                const last = wps[wps.length - 1];
                                const d = haversineMeters(
                                  userLocation.latitude, userLocation.longitude,
                                  last.latitude, last.longitude
                                );
                                const dist = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(2)} km`;
                                return (
                                  <p className="text-[11px] text-muted">
                                    Do mety: <span className="font-semibold text-foreground">{dist}</span>
                                    {savingTime && <span className="ml-2 text-orange-400">Zapisuję…</span>}
                                  </p>
                                );
                              })()}
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => startTimer(route.id)}
                                disabled={timerRouteId !== null || !userLocation || wpCount < 2}
                                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-orange-500/40 bg-orange-600/10 py-2.5 text-xs font-semibold text-orange-400 transition hover:bg-orange-600/20 disabled:opacity-40"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                Start wyzwania
                              </button>
                              {!userLocation && (
                                <p className="mt-1 text-[11px] text-muted">
                                  Włącz lokalizację — meta wykrywana jest automatycznie z GPS.
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        {/* Scoreboard */}
                        <div className="mt-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Tabela wyników</p>
                            <button
                              onClick={() => fetchScores(route.id)}
                              className="text-[10px] text-muted hover:text-foreground transition"
                            >
                              Odśwież
                            </button>
                          </div>
                          {scoresLoading[route.id] ? (
                            <div className="flex justify-center py-3">
                              <svg className="h-4 w-4 animate-spin text-muted" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            </div>
                          ) : !scores[route.id] || scores[route.id].length === 0 ? (
                            <p className="text-center text-xs text-muted py-3">
                              Brak wyników — bądź pierwszy!
                            </p>
                          ) : (
                            <ol className="flex flex-col gap-1.5">
                              {scores[route.id].map((entry, idx) => (
                                <li
                                  key={entry.id}
                                  className="flex items-center gap-2.5 rounded-xl bg-input-bg px-3 py-2"
                                >
                                  <span className={`w-5 text-center text-sm font-bold ${MEDAL_COLORS[idx] ?? 'text-muted'}`}>
                                    {idx < 3 ? ['🥇','🥈','🥉'][idx] : `${idx + 1}.`}
                                  </span>
                                  <span className="flex-1 truncate text-xs font-medium text-foreground">
                                    {entry.user?.name ?? 'Użytkownik'}
                                  </span>
                                  <span className="font-mono text-xs font-bold text-orange-400 tabular-nums">
                                    {formatTime(entry.seconds)}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          )}
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

      {/* Collections tab */}
      {activeSection === 'collections' && (
        <div className="px-1">
          <RouteCollectionsPanel />
        </div>
      )}

      {/* Profile modal — pełny profil otwiera się jako pełna strona w dashboardzie */}
      <MiniProfileModal
        open={!!miniProfile}
        user={miniProfile?.user ?? null}
        context={miniProfile?.context}
        onClose={() => setMiniProfile(null)}
        onOpenFull={(uid) => { onShowProfile?.(uid); setMiniProfile(null); }}
      />

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
