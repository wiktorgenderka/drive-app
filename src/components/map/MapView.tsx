'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import { useMapStore } from '@/stores/useMapStore';
import { useSpotStore } from '@/stores/useSpotStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { useStatsStore } from '@/stores/useStatsStore';
import UserMarker from './UserMarker';
import FriendMarker from './FriendMarker';
import ConvoyMarker from './ConvoyMarker';
import ReportMarker from './ReportMarker';
import SpotMarker from './SpotMarker';
import FuelStationMarker from './FuelStationMarker';
import RouteLayer from './RouteLayer';
import MysteryDriveLayer from './MysteryDriveLayer';
import MysteryDriveHUD from './MysteryDriveHUD';
import EdgePOIIndicators from './EdgePOIIndicators';
import NearbyReportAlert from './NearbyReportAlert';
import ReportProximityPrompt from './ReportProximityPrompt';
import SpeedCameraAlert from './SpeedCameraAlert';
import NavigationHUD from './NavigationHUD';
import TripRecorderUI from './TripRecorderUI';
import TripSummaryModal from './TripSummaryModal';
import SpeedLimitModal from './SpeedLimitModal';
import SearchPanel from './SearchPanel';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { NavStep, parseSteps } from '@/lib/mapNavigation';
import { haversineMeters } from '@/lib/geo';
import { useWeather } from '@/hooks/useWeather';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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

  const { mapTheme } = useThemeStore();
  const activeVehicleId = useProfileStore((s) => s.vehicles.find((v) => v.isActive)?.id ?? null);
  const recordTrip = useStatsStore((s) => s.recordTrip);
  const weather = useWeather(userLocation?.latitude, userLocation?.longitude);
  // For 'auto' theme: use is_day from weather API (sunrise/sunset aware); fallback to time-of-day
  const isDay = weather ? weather.isDay : new Date().getHours() >= 6 && new Date().getHours() < 20;
  // Style bez warstwy ruchu (mapbox-traffic-v1) — wymagałaby tokenu z odpowiednim
  // scope, którego standardowy publiczny token nie ma. Wcześniejsze
  // navigation-day-v1 / navigation-night-v1 spamowały konsolę 401/403 dla tych kafli.
  // Preset 'nfs' korzysta z dark-v11 jako bazy — kolory są nadpisywane runtime'owo
  // w applyNfsLook().
  const MAP_STYLE_URLS: Record<string, string> = {
    auto: isDay ? 'mapbox://styles/mapbox/streets-v12' : 'mapbox://styles/mapbox/dark-v11',
    dark: 'mapbox://styles/mapbox/dark-v11',
    light: 'mapbox://styles/mapbox/light-v11',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    navigation: 'mapbox://styles/mapbox/dark-v11',
    outdoors: 'mapbox://styles/mapbox/outdoors-v12',
    nfs: 'mapbox://styles/mapbox/dark-v11',
  };
  const mapStyle = MAP_STYLE_URLS[mapTheme] ?? MAP_STYLE_URLS.auto;

  // ── Map layers ──
  // Preset "NFS" — uderzeniowe podbicie kolorów na bazie dark-v11.
  // Drogi: gradient od ciemnego pomarańczu (uliczki) do neonowego żółtego (autostrady).
  // Woda: granat z domieszką cyjanu. Tło: prawie czerń. Etykiety POI/POI-like ukryte.
  const applyNfsLook = useCallback((map: mapboxgl.Map) => {
    if (mapTheme !== 'nfs') return;
    if (!map.isStyleLoaded()) return;

    // Helper: bezpieczne ustawienie property — tylko jeśli warstwa istnieje.
    const setPaint = (layerId: string, prop: string, value: unknown) => {
      try {
        if (map.getLayer(layerId)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.setPaintProperty(layerId, prop as any, value as any);
        }
      } catch { /* ignoruj jeśli niezgodne */ }
    };
    const hide = (layerId: string) => {
      try {
        if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', 'none');
      } catch { /* ignoruj */ }
    };

    // Tło / ląd
    setPaint('background', 'background-color', '#040712');
    setPaint('land', 'background-color', '#040712');
    setPaint('landuse', 'fill-color', '#0a0f1a');
    setPaint('national-park', 'fill-color', '#0c1410');
    setPaint('park', 'fill-color', '#0d1612');
    setPaint('pitch', 'fill-color', '#0d1612');

    // Woda — granat z neonowym cyjanem na krawędziach
    setPaint('water', 'fill-color', '#0a1733');
    setPaint('waterway', 'line-color', '#1e3a8a');

    // Drogi — od ciemnego po neonowy żółty zależnie od klasy
    const ROAD_LAYERS: { id: string; color: string; width?: number }[] = [
      { id: 'road-motorway', color: '#fde047' },
      { id: 'road-motorway-trunk', color: '#fde047' },
      { id: 'road-trunk', color: '#facc15' },
      { id: 'road-primary', color: '#f59e0b' },
      { id: 'road-secondary-tertiary', color: '#ea580c' },
      { id: 'road-street', color: '#7c2d12' },
      { id: 'road-minor', color: '#451a03' },
      { id: 'road-pedestrian', color: '#1f2937' },
      { id: 'road-path', color: '#1f2937' },
    ];
    for (const r of ROAD_LAYERS) {
      setPaint(r.id, 'line-color', r.color);
    }
    // Casing (obwódki dróg) — ciemne, żeby drogi się odcinały od tła
    setPaint('road-motorway-case', 'line-color', '#7c2d12');
    setPaint('road-motorway-trunk-case', 'line-color', '#7c2d12');
    setPaint('road-trunk-case', 'line-color', '#7c2d12');
    setPaint('road-primary-case', 'line-color', '#451a03');
    setPaint('road-secondary-tertiary-case', 'line-color', '#1c1917');

    // Budynki — ciemne z lekkim cyjanem
    setPaint('building', 'fill-color', '#0f172a');
    setPaint('building', 'fill-opacity', 0.85);

    // Granice administracyjne — subtelnie cyjanem
    setPaint('admin-0-boundary', 'line-color', '#22d3ee');
    setPaint('admin-1-boundary', 'line-color', '#0e7490');

    // Schowaj śmieci — nazwy POI / drobne etykiety, żeby był czystszy "racing" look
    [
      'poi-label', 'transit-label', 'airport-label', 'natural-line-label',
      'natural-point-label', 'water-line-label', 'water-point-label',
      'waterway-label', 'building-number-label', 'road-number-shield',
    ].forEach(hide);
  }, [mapTheme]);

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

  const is3DRef = useRef(false);

  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    applyNfsLook(map);
    map.on('styledata', () => {
      if (is3DRef.current) add3DLayers(map);
      applyNfsLook(map);
    });
  }, [add3DLayers, applyNfsLook]);

  // Wymuś przeładowanie stylu gdy zmienia się temat — bo niektóre presety
  // (np. dark ↔ nfs) używają tego samego URL i react-map-gl nie zauważy zmiany.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    try {
      map.setStyle(mapStyle);
    } catch { /* ignoruj */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapTheme]);

  // ── Navigation state ──
  const [navDestination, setNavDestination] = useState<{ lng: number; lat: number } | null>(null);
  const [navRoute, setNavRoute] = useState<GeoJSON.Feature | null>(null);
  const [isPickingDestination, setIsPickingDestination] = useState(false);
  const [destinationMarker, setDestinationMarker] = useState<{ lng: number; lat: number } | null>(null);
  const pendingDestNameRef = useRef<string>('');
  const [navSteps, setNavSteps] = useState<NavStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  // Domyślnie mapa podąża za użytkownikiem; wyłącza się gdy ręcznie przeciągniesz mapę.
  const [isFollowing, setIsFollowing] = useState(true);
  const [is3D, setIs3D] = useState(false);
  const [navDestName, setNavDestName] = useState('');
  const [hasArrived, setHasArrived] = useState(false);

  // ── Trip state ──
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

  // ── Speed limit state ──
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

  const handleMoveEnd = useCallback(
    (evt: { viewState: { longitude: number; latitude: number; zoom: number; pitch?: number; bearing?: number } }) => {
      const { longitude, latitude, zoom, pitch, bearing } = evt.viewState;
      setViewState({ longitude, latitude, zoom, pitch: pitch ?? 0, bearing: bearing ?? 0 });
    },
    [setViewState]
  );

  const handleDragStart = useCallback(() => { setIsFollowing(false); }, []);

  const setReports = useMapStore((s) => s.setReports);
  const setFuelStations = useMapStore((s) => s.setFuelStations);
  const showSpots = useMapStore((s) => s.showSpots);
  const showFriends = useMapStore((s) => s.showFriends);
  const friendLocations = useMapStore((s) => s.friendLocations);
  const setSpots = useSpotStore((s) => s.setSpots);
  const spots = useSpotStore((s) => s.spots);
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

      fetch(`/api/spots?lat=${lat}&lng=${lng}&radius=50`)
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => { if (Array.isArray(data)) setSpots(data); })
        .catch(() => {});
    },
    [setReports, setFuelStations, setSpots]
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

  useEffect(() => {
    if (!userLocation) return;
    mapRef.current?.flyTo({ center: [userLocation.longitude, userLocation.latitude], zoom: 14, duration: 800 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.latitude ? 1 : 0]);

  useEffect(() => {
    if (!mapFlyTarget) return;
    const fly = () => {
      mapRef.current?.flyTo({ center: [mapFlyTarget.longitude, mapFlyTarget.latitude], zoom: mapFlyTarget.zoom, duration: 1000 });
      setMapFlyTarget(null);
    };
    if (mapRef.current?.isStyleLoaded()) fly();
    else { const id = setTimeout(fly, 300); return () => clearTimeout(id); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapFlyTarget]);

  useEffect(() => {
    if (!navigationRoute) return;
    const { waypoints, name } = navigationRoute;
    if (waypoints.length < 2) return;
    setNavDestination(null);
    setDestinationMarker(null);
    pendingDestNameRef.current = '';
    const coordStr = waypoints.map((wp) => `${wp.longitude},${wp.latitude}`).join(';');
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;
    fetch(url).then((res) => res.json()).then((data) => {
      if (data.routes?.[0]) {
        const route = data.routes[0];
        setNavRoute({ type: 'Feature', properties: {}, geometry: route.geometry });
        setNavSteps(parseSteps(data));
        setCurrentStepIdx(0);
        setNavDestName(name);
        setHasArrived(false);
        setIsNavigating(true);
        setIsFollowing(true);
        const lngs = waypoints.map((wp) => wp.longitude);
        const lats = waypoints.map((wp) => wp.latitude);
        const bounds: [[number, number], [number, number]] = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];
        const doFit = () => mapRef.current?.fitBounds(bounds, { padding: 80, duration: 1200 });
        if (mapRef.current?.isStyleLoaded()) doFit(); else setTimeout(doFit, 500);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationRoute]);

  useEffect(() => {
    if (!navDestination || !userLocation) return;
    const origin = `${userLocation.longitude},${userLocation.latitude}`;
    const dest = `${navDestination.lng},${navDestination.lat}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin};${dest}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;
    fetch(url).then((res) => res.json()).then((data) => {
      if (data.routes?.[0]) {
        const route = data.routes[0];
        setNavRoute({ type: 'Feature', properties: {}, geometry: route.geometry });
        setNavSteps(parseSteps(data));
        setCurrentStepIdx(0);
        setNavDestName(pendingDestNameRef.current || `${navDestination.lat.toFixed(4)}, ${navDestination.lng.toFixed(4)}`);
        setHasArrived(false);
        setIsNavigating(true);
        setIsFollowing(true);
      }
    }).catch(() => { setNavRoute(null); setIsNavigating(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navDestination, userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    if (!isTripActive || !userLocation) return;
    const prev = tripLastLocRef.current;
    if (prev) {
      const d = haversineMeters(prev.lat, prev.lng, userLocation.latitude, userLocation.longitude);
      if (d < 300) setTripDistance((s) => s + d);
    }
    tripLastLocRef.current = { lat: userLocation.latitude, lng: userLocation.longitude };
    const spd = Math.max(0, (userLocation.speed ?? 0) * 3.6);
    setTripMaxSpeed((s) => Math.max(s, spd));
    setTripSpeedSum((s) => s + spd);
    setTripSpeedCount((s) => s + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]);

  useEffect(() => {
    if (!isTripActive || !tripStartTime) return;
    const id = setInterval(() => { setTripElapsed(Math.floor((Date.now() - tripStartTime) / 1000)); }, 1000);
    return () => clearInterval(id);
  }, [isTripActive, tripStartTime]);

  useEffect(() => {
    if (!isNavigating || !userLocation || navSteps.length === 0) return;
    const step = navSteps[currentStepIdx];
    if (!step) return;
    const dist = haversineMeters(userLocation.latitude, userLocation.longitude, step.maneuverLocation[1], step.maneuverLocation[0]);
    if (dist < 40) {
      if (currentStepIdx >= navSteps.length - 1) setHasArrived(true);
      else setCurrentStepIdx((i) => i + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]);

  useEffect(() => {
    if (!isNavigating || !isFollowing || !userLocation) return;
    mapRef.current?.easeTo({
      center: [userLocation.longitude, userLocation.latitude],
      bearing: userLocation.heading ?? 0,
      pitch: 68, zoom: 17, duration: 600,
      padding: { top: 0, bottom: 240, left: 0, right: 0 },
      easing: (t) => t,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, isFollowing, isNavigating]);

  // Follow poza nawigacją — obrót mapy z kierunkiem jazdy, marker lekko poniżej środka.
  // Pomijamy fixy o bardzo słabej dokładności (>200 m), żeby mapa nie skakała
  // gdy lokalizacja idzie z WiFi i potrafi się "teleportować".
  useEffect(() => {
    if (isNavigating || !isFollowing || !userLocation) return;
    if ((userLocation.accuracy ?? 0) > 200) return;
    const hasHeading = userLocation.heading != null && !Number.isNaN(userLocation.heading);
    mapRef.current?.easeTo({
      center: [userLocation.longitude, userLocation.latitude],
      bearing: hasHeading ? (userLocation.heading as number) : 0,
      pitch: hasHeading ? 40 : 0,
      duration: 800,
      padding: { top: 0, bottom: 200, left: 0, right: 0 },
      easing: (t) => t,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation, isFollowing, isNavigating]);

  // ── Computed ──
  const remainingDistance = isNavigating ? navSteps.slice(currentStepIdx).reduce((s, st) => s + st.distance, 0) : 0;
  const remainingDuration = isNavigating ? navSteps.slice(currentStepIdx).reduce((s, st) => s + st.duration, 0) : 0;

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
    mapRef.current?.easeTo({ pitch: 0, bearing: 0, duration: 600 });
  }

  function startTrip() {
    setIsTripActive(true);
    setTripStartTime(Date.now());
    setTripElapsed(0);
    setTripDistance(0);
    setTripMaxSpeed(0);
    setTripSpeedSum(0);
    setTripSpeedCount(0);
    tripLastLocRef.current = userLocation ? { lat: userLocation.latitude, lng: userLocation.longitude } : null;
  }

  function stopTrip() {
    const avg = tripSpeedCount > 0 ? tripSpeedSum / tripSpeedCount : 0;
    const endedAt = new Date();
    const startedAt = tripStartTime ? new Date(tripStartTime) : new Date(Date.now() - tripElapsed * 1000);
    setFinishedTrip({ distance: tripDistance, duration: tripElapsed, maxSpeed: tripMaxSpeed, avgSpeed: avg });
    setIsTripActive(false);
    setShowTripSummary(true);
    recordTrip(activeVehicleId, { km: tripDistance / 1000, maxSpeedKmh: tripMaxSpeed, minutes: Math.round(tripElapsed / 60) });
    tripLastLocRef.current = null;

    // Persist trip to DB
    fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        distanceKm: tripDistance / 1000,
        maxSpeedKmh: tripMaxSpeed,
        avgSpeedKmh: avg,
        durationMin: Math.round(tripElapsed / 60),
        vehicleId: activeVehicleId ?? undefined,
      }),
    }).catch(() => null); // non-blocking, best-effort
  }

  function handleLocateUser() {
    if (!userLocation) return;
    setIsFollowing(true);
    if (isNavigating) {
      mapRef.current?.easeTo({
        center: [userLocation.longitude, userLocation.latitude],
        bearing: userLocation.heading ?? 0,
        pitch: 68, zoom: 17, duration: 600,
        padding: { top: 0, bottom: 240, left: 0, right: 0 },
      });
    } else {
      const hasHeading = userLocation.heading != null && !Number.isNaN(userLocation.heading);
      mapRef.current?.easeTo({
        center: [userLocation.longitude, userLocation.latitude],
        bearing: hasHeading ? (userLocation.heading as number) : 0,
        pitch: hasHeading ? 40 : 0,
        zoom: 15, duration: 800,
        padding: { top: 0, bottom: 200, left: 0, right: 0 },
      });
    }
  }

  function handleSearchChange(query: string) {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      const proximity = userLocation ? `&proximity=${userLocation.longitude},${userLocation.latitude}` : '';
      fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=5&language=pl${proximity}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.features) {
            setSearchResults(data.features.map((f: { id: string; text: string; place_name: string; center: [number, number] }) => ({
              id: f.id, name: f.text, address: f.place_name, lng: f.center[0], lat: f.center[1],
            })));
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
    // W trybie wybierania celu klik na mapę = potwierdzenie aktualnej pozycji.
    // (UX: użytkownik panuje mapą, klika gdziekolwiek — bierzemy aktualne centrum
    // żeby nie martwił się gdzie dokładnie kliknął.)
    confirmCenterDestination();
    void evt;
  }

  function confirmCenterDestination() {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const c = map.getCenter();
    const lngLat = { lng: c.lng, lat: c.lat };
    setDestinationMarker(lngLat);
    setNavDestination(lngLat);
    setIsPickingDestination(false);
    pendingDestNameRef.current = '';
  }

  function cancelPickingDestination() {
    setIsPickingDestination(false);
    pendingDestNameRef.current = '';
  }

  const speedKmh = userLocation?.speed != null && userLocation.speed >= 0 ? Math.round(userLocation.speed * 3.6) : 0;
  const speedColor = speedLimit && speedKmh > 0
    ? speedKmh > speedLimit ? '#ef4444' : speedKmh > speedLimit * 0.9 ? '#f97316' : '#22c55e'
    : undefined;
  const currentStep = navSteps[currentStepIdx];
  const nextStep = navSteps[currentStepIdx + 1];

  return (
    <div className="w-full h-full relative">
      {!showSearch && !isNavigating && <NearbyReportAlert />}
      {!showSearch && !isNavigating && <ReportProximityPrompt />}
      {!showSearch && <SpeedCameraAlert userLocation={userLocation} reports={reports} />}

      <NavigationHUD
        isNavigating={isNavigating}
        hasArrived={hasArrived}
        navDestName={navDestName}
        currentStep={currentStep}
        nextStep={nextStep}
        isFollowing={isFollowing}
        remainingDistance={remainingDistance}
        remainingDuration={remainingDuration}
        speedKmh={speedKmh}
        userLocation={userLocation}
        onSetFollowing={setIsFollowing}
        onEndNavigation={clearNavigation}
      />

      <TripRecorderUI
        isNavigating={isNavigating}
        isTripActive={isTripActive}
        tripElapsed={tripElapsed}
        tripDistance={tripDistance}
        tripMaxSpeed={tripMaxSpeed}
        speedKmh={speedKmh}
        speedColor={speedColor}
        speedLimit={speedLimit}
        onStartTrip={startTrip}
        onStopTrip={stopTrip}
        onOpenSpeedLimit={() => setShowSpeedLimitModal(true)}
      />

      <TripSummaryModal
        show={showTripSummary}
        trip={finishedTrip}
        onClose={() => setShowTripSummary(false)}
      />

      <SpeedLimitModal
        show={showSpeedLimitModal}
        speedLimit={speedLimit}
        speedLimitInput={speedLimitInput}
        onInputChange={setSpeedLimitInput}
        onSelectPreset={(v) => { setSpeedLimit(v); setSpeedLimitInput(String(v)); setShowSpeedLimitModal(false); }}
        onSetCustom={() => { const v = parseInt(speedLimitInput); if (v > 0) { setSpeedLimit(v); setShowSpeedLimitModal(false); } }}
        onDisable={() => { setSpeedLimit(null); setShowSpeedLimitModal(false); }}
        onClose={() => setShowSpeedLimitModal(false)}
      />

      <SearchPanel
        show={showSearch}
        hasDestination={!!navDestination}
        searchQuery={searchQuery}
        searchResults={searchResults}
        isSearching={isSearching}
        onQueryChange={handleSearchChange}
        onNavigateTo={navigateToPlace}
        onPickOnMap={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); setIsPickingDestination(true); }}
        onClose={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}
      />

      {isPickingDestination && (
        <>
          {/* Tooltip u góry */}
          <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-30 rounded-xl bg-blue-600 px-4 py-2 shadow-lg">
            <p className="text-sm font-medium text-white">Przesuń mapę i potwierdź lokalizację</p>
          </div>

          {/* Stały pin w środku mapy — pointer-events-none, więc nie blokuje przeciągania */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-full">
            <svg width="42" height="48" viewBox="0 0 42 48" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.55))' }}>
              <path
                d="M21 0 C9.4 0 0 9.4 0 21 C0 35.5 21 48 21 48 S42 35.5 42 21 C42 9.4 32.6 0 21 0 Z"
                fill="#2563eb"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <circle cx="21" cy="21" r="6" fill="#ffffff" />
            </svg>
          </div>

          {/* Pasek z akcjami u dołu */}
          <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2 flex items-center gap-2 rounded-2xl border border-card-border bg-card-bg/95 p-2 shadow-xl backdrop-blur-md">
            <button
              onClick={cancelPickingDestination}
              className="rounded-xl border border-card-border bg-input-bg px-4 py-2 text-xs font-semibold text-muted transition hover:text-foreground"
            >
              Anuluj
            </button>
            <button
              onClick={confirmCenterDestination}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M5 13l4 4L19 7" />
              </svg>
              Wybierz to miejsce
            </button>
          </div>
        </>
      )}

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
        {/* Bottom-right controls */}
        <div className="absolute bottom-8 right-2.5 z-10 flex flex-col items-center gap-2">
          {!isNavigating && (
            <button
              onClick={() => { setShowSearch(!showSearch); setIsPickingDestination(false); }}
              className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition-all ${
                showSearch || isPickingDestination ? 'bg-blue-600 text-white' : 'text-muted hover:text-foreground'
              }`}
              style={!(showSearch || isPickingDestination) ? { backgroundColor: 'rgba(24,24,27,0.9)', border: '1px solid #3f3f46', backdropFilter: 'blur(8px)' } : {}}
              title="Nawiguj"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 11l19-9-9 19-2-8-8-2z" />
              </svg>
            </button>
          )}

          <button
            onClick={handleLocateUser}
            className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition-all ${
              isFollowing ? 'bg-blue-600 text-white' : 'text-muted hover:text-foreground'
            }`}
            style={!isFollowing ? { backgroundColor: 'rgba(24,24,27,0.9)', border: '1px solid #3f3f46', backdropFilter: 'blur(8px)' } : {}}
            title={isFollowing ? 'Mapa podąża za Tobą — kliknij by ponownie wycentrować' : 'Podążaj za moją lokalizacją'}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          </button>

          <button
            onClick={() => {
              const next = !is3D;
              const map = mapRef.current?.getMap();
              if (!map) return;
              if (next) { add3DLayers(map); map.easeTo({ pitch: 55, duration: 600 }); }
              else { remove3DLayers(map); map.easeTo({ pitch: 0, duration: 600 }); }
              is3DRef.current = next;
              setIs3D(next);
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg transition-all"
            style={{ backgroundColor: is3D ? '#3b82f6' : 'rgba(24,24,27,0.9)', border: `1px solid ${is3D ? '#60a5fa' : '#3f3f46'}`, backdropFilter: 'blur(8px)' }}
            title="Tryb 3D"
          >
            <span className="text-xs font-black" style={{ color: is3D ? '#fff' : '#a1a1aa' }}>3D</span>
          </button>
        </div>

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

        {navRoute && (
          <Source id="nav-route" type="geojson" data={navRoute}>
            {/* NFS Unbound style: bright neon yellow→orange route with multilayer glow */}
            <Layer
              id="nav-route-glow"
              type="line"
              paint={{ 'line-color': '#fbbf24', 'line-width': 22, 'line-opacity': 0.18, 'line-blur': 8 }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
            <Layer
              id="nav-route-casing"
              type="line"
              paint={{ 'line-color': '#f97316', 'line-width': 11, 'line-opacity': 0.85 }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
            <Layer
              id="nav-route-line"
              type="line"
              paint={{ 'line-color': '#fde047', 'line-width': 5, 'line-opacity': 1 }}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            />
          </Source>
        )}

        {showFriends && Object.values(friendLocations).map((f) => (
          <FriendMarker key={f.userId} friend={f} />
        ))}

        {showConvoyMembers && convoyMembers.map((m) =>
          m.latitude && m.longitude ? <ConvoyMarker key={m.id} latitude={m.latitude} longitude={m.longitude} name={m.name} /> : null
        )}

        {showReports && reports.map((r) => <ReportMarker key={r.id} report={r} />)}
        {showSpots && spots.map((s) => <SpotMarker key={s.id} spot={s} />)}
        {showFuelStations && fuelStations
          .filter((s) => !userLocation || haversineMeters(userLocation.latitude, userLocation.longitude, s.latitude, s.longitude) <= 1000)
          .map((s) => <FuelStationMarker key={s.id} station={s} />)}
        {routes.map((r) => <RouteLayer key={r.id} route={r} />)}
        <MysteryDriveLayer />
        <EdgePOIIndicators />
      </Map>
      <MysteryDriveHUD />
    </div>
  );
}
