'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import { useMapStore } from '@/stores/useMapStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useStatsStore } from '@/stores/useStatsStore';
import { useGeolocation } from '@/hooks/useGeolocation';
import UserMarker from './UserMarker';
import ConvoyMarker from './ConvoyMarker';
import ReportMarker from './ReportMarker';
import FuelStationMarker from './FuelStationMarker';
import RouteLayer from './RouteLayer';
import NearbyReportAlert from './NearbyReportAlert';
import ReportProximityPrompt from './ReportProximityPrompt';
import SpeedCameraAlert from './SpeedCameraAlert';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// ─── Types ──────────────────────────────────────────────────────────────────

interface NavStep {
  instruction: string;
  type: string;
  modifier?: string;
  distance: number;
  duration: number;
  name: string;
  maneuverLocation: [number, number]; // [lng, lat]
  bearingBefore: number; // approach bearing
  bearingAfter: number;  // exit bearing — arrow points this way after turn
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h} godz. ${m} min`;
  return `${Math.max(1, m)} min`;
}

function fmtETA(sec: number): string {
  const d = new Date();
  d.setSeconds(d.getSeconds() + sec);
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSteps(data: any): NavStep[] {
  if (!data.routes?.[0]?.legs) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.routes[0].legs.flatMap((leg: any) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    leg.steps.map((s: any): NavStep => ({
      instruction: s.maneuver?.instruction ?? '',
      type: s.maneuver?.type ?? 'continue',
      modifier: s.maneuver?.modifier,
      distance: s.distance ?? 0,
      duration: s.duration ?? 0,
      name: s.name ?? '',
      maneuverLocation: s.maneuver?.location ?? [0, 0],
      bearingBefore: s.maneuver?.bearing_before ?? 0,
      bearingAfter: s.maneuver?.bearing_after ?? 0,
    }))
  );
}

// Arrow icon — single upward arrow path, rotated via CSS transform
function getArrowRotation(type: string, modifier = ''): number {
  if (type === 'arrive' || type === 'depart') return 0;
  if (modifier.includes('uturn')) return 180;
  if (modifier.includes('sharp right')) return 135;
  if (modifier.includes('sharp left')) return -135;
  if (modifier.includes('slight right')) return 30;
  if (modifier.includes('slight left')) return -30;
  if (modifier.includes('right')) return 90;
  if (modifier.includes('left')) return -90;
  return 0;
}

function ManeuverIcon({ type, modifier, size = 28 }: { type: string; modifier?: string; size?: number }) {
  const rotation = getArrowRotation(type, modifier ?? '');

  if (type === 'arrive') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
      </svg>
    );
  }

  if (type === 'roundabout' || type === 'rotary') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
      </svg>
    );
  }

  if ((modifier ?? '').includes('uturn')) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 5v3l4-4-4-4v3c-4.42 0-8 3.58-8 8h2c0-3.31 2.69-6 6-6zm4 9c-3.31 0-6-2.69-6-6H8c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
      </svg>
    );
  }

  // Generic directional arrow — rotated
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      {/* Up-pointing arrow */}
      <path d="M12 3l-1.5 1.8 4.5 4.7H4v2.5h11l-4.5 4.7 1.5 1.8 7-7.25L12 3z" />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────


export default function MapView() {
  const mapRef = useRef<MapRef>(null);
  const {
    viewState,
    setViewState,
    userLocation,
    convoyMembers,
    reports,
    fuelStations,
    routes,
    showReports,
    showFuelStations,
    showConvoyMembers,
    mapFlyTarget,
    setMapFlyTarget,
    navigationRoute,
    setNavigationRoute,
  } = useMapStore();

  const { mode, mapTheme } = useThemeStore();
  const activeVehicleId = useProfileStore((s) => s.vehicles.find((v) => v.isActive)?.id ?? null);
  const recordTrip = useStatsStore((s) => s.recordTrip);
  const MAP_STYLE_URLS: Record<string, string> = {
    auto: mode === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11',
    dark: 'mapbox://styles/mapbox/dark-v11',
    light: 'mapbox://styles/mapbox/light-v11',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    navigation: 'mapbox://styles/mapbox/navigation-night-v1',
    outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  };
  const mapStyle = MAP_STYLE_URLS[mapTheme] ?? MAP_STYLE_URLS.auto;

  useGeolocation({ enableHighAccuracy: true, autoStart: true });

  // ── Add custom arrow image to Mapbox for route direction indicators ──
  const addRouteArrowImage = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    if (map.hasImage('route-arrow')) return;
    const size = 22;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Upward-pointing filled arrowhead (north = 0°; Mapbox rotates it along the line)
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(size / 2, 1);      // tip
    ctx.lineTo(size - 2, size);   // bottom-right
    ctx.lineTo(size / 2, size - 6); // inner notch
    ctx.lineTo(2, size);           // bottom-left
    ctx.closePath();
    ctx.fill();
    const imgData = ctx.getImageData(0, 0, size, size);
    map.addImage('route-arrow', { width: size, height: size, data: imgData.data }, { sdf: true });
  }, []);

  const add3DLayers = useCallback((map: mapboxgl.Map) => {
    if (!map.getSource('mapbox-dem')) {
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });
    }
    if (!map.getLayer('sky')) {
      map.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 90.0],
          'sky-atmosphere-sun-intensity': 15,
          'sky-atmosphere-color': 'rgba(85,151,210,1)',
          'sky-atmosphere-halo-color': 'rgba(135,196,240,0.5)',
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }
    if (!map.getLayer('3d-buildings')) {
      map.addLayer({
        id: '3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', 'extrude', 'true'],
        type: 'fill-extrusion',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['get', 'height'],
            0, '#1e293b', 50, '#334155', 200, '#475569',
          ],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.5, ['get', 'height']],
          'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.5, ['get', 'min_height']],
          'fill-extrusion-opacity': 0.85,
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
  }, []);

  const remove3DLayers = useCallback((map: mapboxgl.Map) => {
    map.setTerrain(null);
    if (map.getLayer('sky')) map.removeLayer('sky');
    if (map.getLayer('3d-buildings')) map.removeLayer('3d-buildings');
    if (map.getSource('mapbox-dem')) map.removeSource('mapbox-dem');
  }, []);

  const handleMapLoad = useCallback(() => {
    addRouteArrowImage();
    const map = mapRef.current?.getMap();
    map?.on('styledata', () => {
      addRouteArrowImage();
      // Re-apply 3D after style reload
      if (is3DRef.current) {
        add3DLayers(map);
      }
    });
  }, [addRouteArrowImage, add3DLayers]);

  // ── Basic nav state (single destination) ──
  const [navDestination, setNavDestination] = useState<{ lng: number; lat: number } | null>(null);
  const [navRoute, setNavRoute] = useState<GeoJSON.Feature | null>(null);
  const [isPickingDestination, setIsPickingDestination] = useState(false);
  const [destinationMarker, setDestinationMarker] = useState<{ lng: number; lat: number } | null>(null);
  const pendingDestNameRef = useRef<string>('');

  // ── Turn-by-turn state ──
  const [navSteps, setNavSteps] = useState<NavStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const is3DRef = useRef(false);
  const [navDestName, setNavDestName] = useState('');
  const [hasArrived, setHasArrived] = useState(false);

  // ── Trip recorder ──
  const [isTripActive, setIsTripActive] = useState(false);
  const [tripStartTime, setTripStartTime] = useState<number | null>(null);
  const [tripElapsed, setTripElapsed] = useState(0);
  const [tripDistance, setTripDistance] = useState(0);
  const [tripMaxSpeed, setTripMaxSpeed] = useState(0);
  const [tripSpeedSum, setTripSpeedSum] = useState(0);
  const [tripSpeedCount, setTripSpeedCount] = useState(0);
  const tripLastLocRef = useRef<{ lat: number; lng: number } | null>(null);
  const [showTripSummary, setShowTripSummary] = useState(false);
  const [finishedTrip, setFinishedTrip] = useState<{
    distance: number; duration: number; maxSpeed: number; avgSpeed: number;
  } | null>(null);

  // ── Speed limit ──
  const [speedLimit, setSpeedLimit] = useState<number | null>(null);
  const [showSpeedLimitModal, setShowSpeedLimitModal] = useState(false);
  const [speedLimitInput, setSpeedLimitInput] = useState('50');

  // ── Search state ──
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    { id: string; name: string; address: string; lng: number; lat: number }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only fires when movement fully stops — avoids 60fps Zustand updates
  const handleMoveEnd = useCallback(
    (evt: { viewState: { longitude: number; latitude: number; zoom: number; pitch?: number; bearing?: number } }) => {
      const { longitude, latitude, zoom, pitch, bearing } = evt.viewState;
      setViewState({ longitude, latitude, zoom, pitch: pitch ?? 0, bearing: bearing ?? 0 });
    },
    [setViewState]
  );

  const handleDragStart = useCallback(() => {
    setIsFollowing(false);
  }, []);

  const setReports = useMapStore((s) => s.setReports);
  const setFuelStations = useMapStore((s) => s.setFuelStations);
  const lastFetchRef = useRef<string>('');

  const fetchMapData = useCallback(
    (lat: number, lng: number) => {
      fetch(`/api/reports?lat=${lat}&lng=${lng}&radius=50`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) {
            setReports(
              data.map(
                (r: {
                  id: string; type: string; latitude: number; longitude: number;
                  description?: string; userId: string; user?: { name: string };
                  createdAt: string; expiresAt: string; upvotes?: number;
                  downvotes?: number; userVote?: boolean | null;
                  isOwner?: boolean; confirmedAt?: string | null;
                }) => ({
                  id: r.id, type: r.type, latitude: r.latitude, longitude: r.longitude,
                  description: r.description, createdBy: r.user?.name ?? r.userId,
                  createdAt: r.createdAt, expiresAt: r.expiresAt,
                  upvotes: r.upvotes ?? 0, downvotes: r.downvotes ?? 0,
                  userVote: r.userVote ?? null, isOwner: r.isOwner ?? false,
                  confirmedAt: r.confirmedAt ?? null,
                })
              )
            );
          }
        })
        .catch(() => {});

      fetch(`/api/fuel?lat=${lat}&lng=${lng}&radius=5`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => { if (Array.isArray(data)) setFuelStations(data); })
        .catch(() => {});
    },
    [setReports, setFuelStations]
  );

  useEffect(() => {
    if (!userLocation) return;
    const locKey = `${userLocation.latitude.toFixed(2)},${userLocation.longitude.toFixed(2)}`;
    if (locKey === lastFetchRef.current) return;
    lastFetchRef.current = locKey;
    fetchMapData(userLocation.latitude, userLocation.longitude);
  }, [userLocation, fetchMapData]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (userLocation) fetchMapData(userLocation.latitude, userLocation.longitude);
    }, 60000);
    return () => clearInterval(interval);
  }, [userLocation, fetchMapData]);

  // Initial center on user — use mapRef so no state update needed
  useEffect(() => {
    if (!userLocation) return;
    mapRef.current?.flyTo({
      center: [userLocation.longitude, userLocation.latitude],
      zoom: 14,
      duration: 800,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.latitude ? 1 : 0]);

  // Fly to target from RoutePanel (show on map)
  useEffect(() => {
    if (!mapFlyTarget) return;
    const fly = () => {
      mapRef.current?.flyTo({
        center: [mapFlyTarget.longitude, mapFlyTarget.latitude],
        zoom: mapFlyTarget.zoom,
        duration: 1000,
      });
      setMapFlyTarget(null);
    };
    if (mapRef.current?.isStyleLoaded()) fly();
    else {
      const id = setTimeout(fly, 300);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapFlyTarget]);

  // ── Activate turn-by-turn from store (RoutePanel "Nawiguj") ──
  useEffect(() => {
    if (!navigationRoute) return;
    const { waypoints, name } = navigationRoute;
    if (waypoints.length < 2) return;

    setNavDestination(null);
    setDestinationMarker(null);
    pendingDestNameRef.current = '';

    const coordStr = waypoints.map((wp) => `${wp.longitude},${wp.latitude}`).join(';');
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.routes?.[0]) {
          const route = data.routes[0];
          setNavRoute({ type: 'Feature', properties: {}, geometry: route.geometry });
          const steps = parseSteps(data);
          setNavSteps(steps);
          setCurrentStepIdx(0);
          setNavDestName(name);
          setHasArrived(false);
          setIsNavigating(true);
          setIsFollowing(true);

          // Fit to route bounds first, then follow kicks in
          const lngs = waypoints.map((wp) => wp.longitude);
          const lats = waypoints.map((wp) => wp.latitude);
          const bounds: [[number, number], [number, number]] = [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ];
          const doFit = () =>
            mapRef.current?.fitBounds(bounds, { padding: 80, duration: 1200 });
          if (mapRef.current?.isStyleLoaded()) doFit();
          else setTimeout(doFit, 500);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationRoute]);

  // ── Activate single-destination navigation ──
  useEffect(() => {
    if (!navDestination || !userLocation) return;

    const origin = `${userLocation.longitude},${userLocation.latitude}`;
    const dest = `${navDestination.lng},${navDestination.lat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin};${dest}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.routes?.[0]) {
          const route = data.routes[0];
          setNavRoute({ type: 'Feature', properties: {}, geometry: route.geometry });
          const steps = parseSteps(data);
          setNavSteps(steps);
          setCurrentStepIdx(0);
          setNavDestName(
            pendingDestNameRef.current ||
              `${navDestination.lat.toFixed(4)}, ${navDestination.lng.toFixed(4)}`
          );
          setHasArrived(false);
          setIsNavigating(true);
          setIsFollowing(true);
        }
      })
      .catch(() => {
        setNavRoute(null);
        setIsNavigating(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navDestination, userLocation?.latitude, userLocation?.longitude]);

  // ── Trip: track distance + speed ──
  useEffect(() => {
    if (!isTripActive || !userLocation) return;
    const prev = tripLastLocRef.current;
    if (prev) {
      const d = haversineMeters(prev.lat, prev.lng, userLocation.latitude, userLocation.longitude);
      if (d < 300) setTripDistance((s) => s + d); // ignore GPS jumps
    }
    tripLastLocRef.current = { lat: userLocation.latitude, lng: userLocation.longitude };
    const spd = Math.max(0, (userLocation.speed ?? 0) * 3.6);
    setTripMaxSpeed((s) => Math.max(s, spd));
    setTripSpeedSum((s) => s + spd);
    setTripSpeedCount((s) => s + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]);

  // ── Trip: elapsed timer ──
  useEffect(() => {
    if (!isTripActive || !tripStartTime) return;
    const id = setInterval(() => {
      setTripElapsed(Math.floor((Date.now() - tripStartTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isTripActive, tripStartTime]);

  // ── Step advancement ──
  useEffect(() => {
    if (!isNavigating || !userLocation || navSteps.length === 0) return;
    const step = navSteps[currentStepIdx];
    if (!step) return;

    const dist = haversineMeters(
      userLocation.latitude, userLocation.longitude,
      step.maneuverLocation[1], step.maneuverLocation[0]
    );

    if (dist < 40) {
      if (currentStepIdx >= navSteps.length - 1) {
        setHasArrived(true);
      } else {
        setCurrentStepIdx((i) => i + 1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]);

  // ── Map follow + heading rotation ──
  useEffect(() => {
    if (!isNavigating || !isFollowing || !userLocation) return;
    const bearing = userLocation.heading ?? 0;
    mapRef.current?.easeTo({
      center: [userLocation.longitude, userLocation.latitude],
      bearing,
      pitch: 68,
      zoom: 17,
      duration: 600,
      padding: { top: 0, bottom: 240, left: 0, right: 0 },
      easing: (t) => t,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, isFollowing, isNavigating]);

  // ── Computed remaining distance / duration ──
  const remainingDistance = isNavigating
    ? navSteps.slice(currentStepIdx).reduce((s, st) => s + st.distance, 0)
    : 0;
  const remainingDuration = isNavigating
    ? navSteps.slice(currentStepIdx).reduce((s, st) => s + st.duration, 0)
    : 0;

  function clearNavigation() {
    setNavDestination(null);
    setNavRoute(null);
    setNavSteps([]);
    setCurrentStepIdx(0);
    setIsNavigating(false);
    setIsFollowing(false);
    setNavDestName('');
    setHasArrived(false);
    setDestinationMarker(null);
    setIsPickingDestination(false);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    pendingDestNameRef.current = '';
    setNavigationRoute(null);
    // Reset pitch and bearing
    mapRef.current?.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  }

  // ── Trip recorder ──
  function startTrip() {
    setIsTripActive(true);
    setTripStartTime(Date.now());
    setTripElapsed(0);
    setTripDistance(0);
    setTripMaxSpeed(0);
    setTripSpeedSum(0);
    setTripSpeedCount(0);
    tripLastLocRef.current = userLocation
      ? { lat: userLocation.latitude, lng: userLocation.longitude }
      : null;
  }

  function stopTrip() {
    const avg = tripSpeedCount > 0 ? tripSpeedSum / tripSpeedCount : 0;
    setFinishedTrip({ distance: tripDistance, duration: tripElapsed, maxSpeed: tripMaxSpeed, avgSpeed: avg });
    setIsTripActive(false);
    setShowTripSummary(true);
    recordTrip(activeVehicleId, {
      km: tripDistance / 1000,
      maxSpeedKmh: tripMaxSpeed,
      minutes: Math.round(tripElapsed / 60),
    });
    tripLastLocRef.current = null;
  }

  function fmtTripTime(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  // ── Locate user ──
  function handleLocateUser() {
    if (userLocation) {
      if (isNavigating) {
        setIsFollowing(true);
      } else {
        mapRef.current?.flyTo({
          center: [userLocation.longitude, userLocation.latitude],
          zoom: 15,
          duration: 1000,
        });
      }
    }
  }

  // ── Search ──
  function handleSearchChange(query: string) {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      const proximity = userLocation
        ? `&proximity=${userLocation.longitude},${userLocation.latitude}`
        : '';
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&language=pl${proximity}`
      )
        .then((r) => r.json())
        .then((data) => {
          if (data.features) {
            setSearchResults(
              data.features.map((f: { id: string; text: string; place_name: string; center: [number, number] }) => ({
                id: f.id, name: f.text, address: f.place_name,
                lng: f.center[0], lat: f.center[1],
              }))
            );
          }
        })
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false));
    }, 300);
  }

  function navigateToPlace(place: { name: string; lng: number; lat: number }) {
    const dest = { lng: place.lng, lat: place.lat };
    setDestinationMarker(dest);
    setNavDestination(dest);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setIsPickingDestination(false);
    pendingDestNameRef.current = place.name;
    mapRef.current?.flyTo({ center: [place.lng, place.lat], zoom: 12, duration: 1500 });
  }

  function handleMapClick(evt: { lngLat: { lng: number; lat: number } }) {
    if (!isPickingDestination) return;
    setDestinationMarker(evt.lngLat);
    setNavDestination(evt.lngLat);
    setIsPickingDestination(false);
    pendingDestNameRef.current = '';
  }

  const speedKmh =
    userLocation?.speed != null && userLocation.speed >= 0
      ? Math.round(userLocation.speed * 3.6)
      : 0;

  const speedColor = speedLimit && speedKmh > 0
    ? speedKmh > speedLimit ? '#ef4444'
    : speedKmh > speedLimit * 0.9 ? '#f97316'
    : '#22c55e'
    : undefined;

  const currentStep = navSteps[currentStepIdx];
  const nextStep = navSteps[currentStepIdx + 1];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full relative">
      {!showSearch && !isNavigating && <NearbyReportAlert />}
      {!showSearch && !isNavigating && <ReportProximityPrompt />}
      {!showSearch && <SpeedCameraAlert userLocation={userLocation} reports={reports} />}

      {/* ── Apple Maps-style navigation HUD ── */}
      {isNavigating && !showSearch && (
        <>
          {/* TOP: Instruction card */}
          <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-3">
            {hasArrived ? (
              /* Arrival card */
              <div className="flex items-center gap-4 rounded-2xl bg-emerald-500 px-5 py-4 shadow-2xl">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <svg className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-bold text-white">Dotarłeś do celu!</p>
                  <p className="text-sm text-white/80 truncate">{navDestName}</p>
                </div>
                <button
                  onClick={clearNavigation}
                  className="shrink-0 rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/30"
                >
                  Zakończ
                </button>
              </div>
            ) : currentStep ? (
              /* Turn instruction card */
              <div className="overflow-hidden rounded-2xl shadow-2xl" style={{ background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(12px)' }}>
                {/* Main instruction row */}
                <div className="flex items-center gap-4 px-4 py-4">
                  {/* Maneuver icon box */}
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: '#3b82f6' }}
                  >
                    <ManeuverIcon type={currentStep.type} modifier={currentStep.modifier} size={34} />
                  </div>

                  {/* Distance + instruction */}
                  <div className="min-w-0 flex-1">
                    <div className="text-3xl font-extrabold leading-none text-white">
                      {fmtDist(
                        (() => {
                          if (!userLocation) return currentStep.distance;
                          const d = haversineMeters(
                            userLocation.latitude, userLocation.longitude,
                            currentStep.maneuverLocation[1], currentStep.maneuverLocation[0]
                          );
                          return Math.min(d, currentStep.distance);
                        })()
                      )}
                    </div>
                    <div className="mt-1 text-sm font-medium text-white/90 truncate">
                      {currentStep.instruction || (currentStep.name ? `Jedź przez ${currentStep.name}` : 'Kontynuuj jazdę')}
                    </div>
                  </div>
                </div>

                {/* Next step preview */}
                {nextStep && (
                  <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <ManeuverIcon type={nextStep.type} modifier={nextStep.modifier} size={16} />
                    </div>
                    <span className="text-xs text-white/60 truncate">
                      Następnie: {nextStep.instruction || nextStep.name || 'Kontynuuj'}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-white/50">
                      {fmtDist(nextStep.distance)}
                    </span>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* BOTTOM: ETA bar */}
          <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-6">
            <div
              className="flex items-center gap-4 rounded-2xl px-5 py-4 shadow-2xl"
              style={{ background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(12px)' }}
            >
              {/* ETA */}
              <div className="min-w-0">
                <div className="text-2xl font-extrabold leading-none text-white">
                  {fmtETA(remainingDuration)}
                </div>
                <div className="mt-0.5 text-xs text-white/50">szacowany przyjazd</div>
              </div>

              <div className="h-8 w-px bg-white/15" />

              {/* Remaining */}
              <div className="min-w-0">
                <div className="text-lg font-bold leading-none text-white">
                  {fmtDist(remainingDistance)}
                </div>
                <div className="mt-0.5 text-xs text-white/50">{fmtTime(remainingDuration)}</div>
              </div>

              <div className="ml-auto shrink-0 flex items-center gap-2">
                {/* Re-center button */}
                {!isFollowing && (
                  <button
                    onClick={() => setIsFollowing(true)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg transition hover:bg-blue-700"
                    title="Wróć do trasy"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="4" />
                      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                    </svg>
                  </button>
                )}
                {/* End navigation */}
                <button
                  onClick={clearNavigation}
                  className="flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                  Zakończ
                </button>
              </div>
            </div>
          </div>

          {/* Speed indicator (bottom-left, above bottom bar) */}
          <div className="absolute bottom-28 left-4 z-30">
            <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-white shadow-lg">
              <span className="text-base font-extrabold leading-none text-gray-900">{speedKmh}</span>
              <span className="text-[9px] font-semibold text-gray-500">km/h</span>
            </div>
          </div>
        </>
      )}

      {/* ── Bottom-left: speed + trip recorder ── */}
      {!isNavigating && (
        <div className="absolute bottom-6 left-4 z-10 flex flex-col items-center gap-3">
          {/* Speed — clickable to set limit */}
          <button
            onClick={() => setShowSpeedLimitModal(true)}
            className="flex h-16 w-16 flex-col items-center justify-center rounded-full bg-card-bg/90 border-2 shadow-lg backdrop-blur-md transition"
            style={{ borderColor: speedColor ?? 'var(--card-border)' }}
            title="Ustaw limit prędkości"
          >
            <span className="text-lg font-bold leading-none" style={{ color: speedColor ?? 'var(--foreground)' }}>
              {speedKmh}
            </span>
            <span className="text-[10px] font-medium text-muted">km/h</span>
            {speedLimit && (
              <span className="text-[8px] text-muted leading-none">/{speedLimit}</span>
            )}
          </button>

          {/* Trip recorder */}
          <button
            onClick={isTripActive ? stopTrip : startTrip}
            className={`flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition ${
              isTripActive
                ? 'bg-red-600 text-white'
                : 'bg-card-bg/90 border border-card-border backdrop-blur-md text-muted hover:text-foreground'
            }`}
            title={isTripActive ? 'Zakończ podróż' : 'Rozpocznij podróż'}
          >
            {isTripActive ? (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 8 12 12 14 14" />
              </svg>
            )}
          </button>
        </div>
      )}

      {/* ── Trip recording bar ── */}
      {isTripActive && !isNavigating && (
        <div className="absolute top-3 left-3 right-16 z-20">
          <div className="flex items-center gap-2.5 rounded-2xl border border-card-border bg-card-bg/95 px-3 py-2.5 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold text-red-500">REC</span>
            </div>
            <div className="h-4 w-px bg-card-border shrink-0" />
            <span className="font-mono text-sm font-bold text-foreground shrink-0">{fmtTripTime(tripElapsed)}</span>
            <div className="h-4 w-px bg-card-border shrink-0" />
            <span className="text-xs font-semibold text-foreground shrink-0">{fmtDist(tripDistance)}</span>
            {tripMaxSpeed > 0 && (
              <>
                <div className="h-4 w-px bg-card-border shrink-0" />
                <span className="text-xs text-muted shrink-0">
                  max <span className="font-bold text-foreground">{Math.round(tripMaxSpeed)}</span>
                </span>
              </>
            )}
            <button
              onClick={stopTrip}
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="1.5" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Trip summary modal ── */}
      {showTripSummary && finishedTrip && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-card-border bg-card-bg p-6 shadow-2xl">
            <h2 className="mb-1 text-lg font-bold text-foreground">Podróż zakończona</h2>
            <p className="mb-5 text-xs text-muted">
              {new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <div className="mb-5 grid grid-cols-2 gap-3">
              {[
                { label: 'Czas', value: fmtTripTime(finishedTrip.duration) },
                { label: 'Dystans', value: fmtDist(finishedTrip.distance) },
                { label: 'Max prędkość', value: `${Math.round(finishedTrip.maxSpeed)} km/h` },
                { label: 'Śr. prędkość', value: `${Math.round(finishedTrip.avgSpeed)} km/h` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-input-bg px-4 py-3">
                  <p className="text-lg font-extrabold text-foreground">{value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowTripSummary(false)}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Zamknij
            </button>
          </div>
        </div>
      )}

      {/* ── Speed limit modal ── */}
      {showSpeedLimitModal && (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSpeedLimitModal(false); }}
        >
          <div className="w-full rounded-t-3xl border-t border-card-border bg-card-bg p-6 pb-10 shadow-2xl">
            <h2 className="mb-4 text-base font-bold text-foreground">Limit prędkości</h2>
            <div className="mb-4 flex flex-wrap gap-2">
              {[30, 50, 70, 90, 110, 130].map((v) => (
                <button
                  key={v}
                  onClick={() => { setSpeedLimit(v); setSpeedLimitInput(String(v)); setShowSpeedLimitModal(false); }}
                  className={`flex h-12 w-14 items-center justify-center rounded-xl border-2 text-sm font-bold transition ${
                    speedLimit === v
                      ? 'border-blue-500 bg-blue-600 text-white'
                      : 'border-card-border text-foreground hover:border-blue-500/50'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="mb-3 flex gap-2">
              <input
                type="number" value={speedLimitInput}
                onChange={(e) => setSpeedLimitInput(e.target.value)}
                placeholder="Własny limit..."
                className="flex-1 rounded-xl border border-input-border bg-input-bg px-4 py-2.5 text-sm text-foreground outline-none focus:border-blue-500"
              />
              <button
                onClick={() => { const v = parseInt(speedLimitInput); if (v > 0) { setSpeedLimit(v); setShowSpeedLimitModal(false); } }}
                className="rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
              >
                Ustaw
              </button>
            </div>
            {speedLimit && (
              <button
                onClick={() => { setSpeedLimit(null); setShowSpeedLimitModal(false); }}
                className="w-full rounded-xl border border-card-border py-2.5 text-sm text-muted transition hover:border-white/30"
              >
                Wyłącz limit
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Search panel ── */}
      {showSearch && !navDestination && (
        <div className="absolute inset-0 z-40 flex flex-col bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <button
              onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card-bg border border-card-border text-muted transition hover:text-foreground"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-2.5">
              <svg className="h-5 w-5 text-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text" autoFocus value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Wpisz miasto, ulicę lub miejsce..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-light outline-none"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="rounded-lg p-0.5 text-muted hover:text-foreground">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4">
            {isSearching && searchQuery.length >= 2 && (
              <div className="flex items-center justify-center py-8">
                <svg className="h-6 w-6 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="flex flex-col gap-1">
                {searchResults.map((place) => (
                  <button key={place.id} onClick={() => navigateToPlace(place)}
                    className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-card-bg"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/15 text-blue-500">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
                      </svg>
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-sm font-medium text-foreground truncate">{place.name}</p>
                      <p className="text-xs text-muted truncate">{place.address}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-muted">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <p className="text-sm">Brak wyników</p>
              </div>
            )}

            <button
              onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); setIsPickingDestination(true); }}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 mt-2 text-left transition hover:bg-card-bg"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-500">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Wskaż na mapie</p>
                <p className="text-xs text-muted">Kliknij punkt na mapie</p>
              </div>
            </button>

            {searchQuery.length < 2 && searchResults.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-muted">
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M3 11l19-9-9 19-2-8-8-2z" />
                </svg>
                <p className="text-sm">Wpisz cel podróży</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Picking destination hint */}
      {isPickingDestination && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 rounded-xl bg-blue-600 px-4 py-2 shadow-lg">
          <p className="text-sm font-medium text-white">Kliknij na mapę, aby wybrać cel</p>
        </div>
      )}

      {/* ── Map ── */}
      <Map
        ref={mapRef}
        initialViewState={viewState}
        onMoveEnd={handleMoveEnd}
        onDragStart={handleDragStart}
        onClick={handleMapClick}
        onLoad={handleMapLoad}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        cursor={isPickingDestination ? 'crosshair' : undefined}
      >
        {/* ── Bottom-right controls: nawiguj + lokalizacja + 3D ── */}
        <div className="absolute bottom-8 right-2.5 z-10 flex flex-col items-center gap-2">

          {/* Navigate / Search toggle */}
          {!isNavigating && (
            <button
              onClick={() => { setShowSearch(!showSearch); setIsPickingDestination(false); }}
              className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition-all ${
                showSearch || isPickingDestination
                  ? 'bg-blue-600 text-white'
                  : 'text-muted hover:text-foreground'
              }`}
              style={!(showSearch || isPickingDestination) ? {
                backgroundColor: 'rgba(24,24,27,0.9)',
                border: '1px solid #3f3f46',
                backdropFilter: 'blur(8px)',
              } : {}}
              title="Nawiguj"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 11l19-9-9 19-2-8-8-2z" />
              </svg>
            </button>
          )}

          {/* Locate me */}
          {!isNavigating && (
            <button
              onClick={handleLocateUser}
              className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition-all text-muted hover:text-foreground"
              style={{ backgroundColor: 'rgba(24,24,27,0.9)', border: '1px solid #3f3f46', backdropFilter: 'blur(8px)' }}
              title="Moja lokalizacja"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
              </svg>
            </button>
          )}

          {/* 3D toggle */}
          <button
            onClick={() => {
              const next = !is3D;
              const map = mapRef.current?.getMap();
              if (!map) return;
              if (next) {
                add3DLayers(map);
                map.easeTo({ pitch: 55, duration: 600 });
              } else {
                remove3DLayers(map);
                map.easeTo({ pitch: 0, duration: 600 });
              }
              is3DRef.current = next;
              setIs3D(next);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition-all"
            style={{
              backgroundColor: is3D ? '#3b82f6' : 'rgba(24,24,27,0.9)',
              border: `1px solid ${is3D ? '#60a5fa' : '#3f3f46'}`,
              backdropFilter: 'blur(8px)',
            }}
            title="Tryb 3D"
          >
            <span className="text-xs font-black" style={{ color: is3D ? '#fff' : '#a1a1aa' }}>3D</span>
          </button>
        </div>

        {/* 3D layers managed imperatively via add3DLayers / remove3DLayers */}

        {userLocation && (
          <UserMarker
            latitude={userLocation.latitude}
            longitude={userLocation.longitude}
            heading={userLocation.heading}
            isNavigating={isNavigating}
          />
        )}

        {destinationMarker && (
          <Marker longitude={destinationMarker.lng} latitude={destinationMarker.lat} anchor="bottom">
            <svg className="h-8 w-8 text-blue-500 drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
            </svg>
          </Marker>
        )}

        {/* Navigation route */}
        {navRoute && (
          <Source id="nav-route" type="geojson" data={navRoute}>
            <Layer id="nav-route-casing" type="line"
              paint={{ 'line-color': '#1e40af', 'line-width': 9, 'line-opacity': 0.6 }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
            <Layer id="nav-route-line" type="line"
              paint={{ 'line-color': '#3b82f6', 'line-width': 6, 'line-opacity': 1 }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
          </Source>
        )}

        {/* Turn arrows — only at maneuver points (turns/roundabouts), not along straights */}
        {isNavigating && navSteps.length > 0 && (
          <Source
            id="nav-turns"
            type="geojson"
            data={{
              type: 'FeatureCollection',
              features: navSteps
                .filter((s, i) =>
                  i > currentStepIdx &&
                  !['depart', 'arrive', 'continue'].includes(s.type)
                )
                .map((s) => ({
                  type: 'Feature' as const,
                  geometry: { type: 'Point' as const, coordinates: s.maneuverLocation },
                  properties: { bearing: s.bearingAfter },
                })),
            }}
          >
            <Layer
              id="nav-turn-arrows"
              type="symbol"
              layout={{
                'icon-image': 'route-arrow',
                'icon-size': 0.85,
                'icon-rotation-alignment': 'map',
                'icon-pitch-alignment': 'map',
                'icon-rotate': ['get', 'bearing'],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              }}
              paint={{ 'icon-color': '#ffffff', 'icon-opacity': 1 }}
            />
          </Source>
        )}

        {showConvoyMembers &&
          convoyMembers.map((m) =>
            m.latitude && m.longitude ? (
              <ConvoyMarker key={m.id} latitude={m.latitude} longitude={m.longitude} name={m.name} />
            ) : null
          )}

        {showReports && reports.map((r) => <ReportMarker key={r.id} report={r} />)}

        {showFuelStations && fuelStations.map((s) => <FuelStationMarker key={s.id} station={s} />)}

        {routes.map((r) => <RouteLayer key={r.id} route={r} />)}
      </Map>
    </div>
  );
}
