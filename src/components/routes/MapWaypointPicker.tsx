'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import { useMapStore } from '@/stores/useMapStore';
import { useThemeStore } from '@/stores/useThemeStore';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface PickedPoint {
  latitude: number;
  longitude: number;
  label: string;
}

interface MapWaypointPickerProps {
  open: boolean;
  onClose: () => void;
  onPointPicked: (point: PickedPoint) => void;
  existingWaypoints: { latitude: number; longitude: number; label: string }[];
}

export default function MapWaypointPicker({
  open,
  onClose,
  onPointPicked,
  existingWaypoints,
}: MapWaypointPickerProps) {
  const userLocation = useMapStore((s) => s.userLocation);
  const { mode } = useThemeStore();
  const mapRef = useRef<MapRef>(null);

  const [pendingPoint, setPendingPoint] = useState<{ lng: number; lat: number } | null>(null);
  const [reverseLabel, setReverseLabel] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const mapStyle =
    mode === 'dark'
      ? 'mapbox://styles/mapbox/dark-v11'
      : 'mapbox://styles/mapbox/light-v11';

  const initialView = {
    longitude: userLocation?.longitude ?? 19.9449,
    latitude: userLocation?.latitude ?? 50.0647,
    zoom: 12,
  };

  const reverseGeocode = useCallback(async (lng: number, lat: number) => {
    if (!MAPBOX_TOKEN) {
      setReverseLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      return;
    }
    setLoadingLabel(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&limit=1&language=pl`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        setReverseLabel(data.features[0].place_name);
      } else {
        setReverseLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      }
    } catch {
      setReverseLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } finally {
      setLoadingLabel(false);
    }
  }, []);

  function handleMapClick(evt: { lngLat: { lng: number; lat: number } }) {
    const { lng, lat } = evt.lngLat;
    setPendingPoint({ lng, lat });
    setReverseLabel(null);
    reverseGeocode(lng, lat);
  }

  function handleAddAndContinue() {
    if (!pendingPoint) return;
    onPointPicked({
      latitude: pendingPoint.lat,
      longitude: pendingPoint.lng,
      label: reverseLabel ?? `${pendingPoint.lat.toFixed(4)}, ${pendingPoint.lng.toFixed(4)}`,
    });
    setPendingPoint(null);
    setReverseLabel(null);
  }

  function handleAddAndClose() {
    if (!pendingPoint) return;
    onPointPicked({
      latitude: pendingPoint.lat,
      longitude: pendingPoint.lng,
      label: reverseLabel ?? `${pendingPoint.lat.toFixed(4)}, ${pendingPoint.lng.toFixed(4)}`,
    });
    setPendingPoint(null);
    setReverseLabel(null);
    onClose();
  }

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 pt-4">
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-xl bg-card-bg/90 px-3 py-2 shadow-lg backdrop-blur-md border border-card-border transition hover:bg-card-bg"
        >
          <svg className="h-5 w-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-semibold text-foreground">Powrót</span>
        </button>

        {existingWaypoints.length > 0 && (
          <div className="rounded-xl bg-card-bg/90 px-3 py-2 shadow-lg backdrop-blur-md border border-card-border">
            <span className="text-xs font-semibold text-muted">
              {existingWaypoints.length} {existingWaypoints.length === 1 ? 'punkt' : 'punktów'}
            </span>
          </div>
        )}
      </div>

      {/* Hint banner */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 rounded-xl bg-orange-600 px-4 py-2 shadow-lg">
        <p className="text-sm font-medium text-white">Kliknij na mapę, aby dodać punkt trasy</p>
      </div>

      {/* Map */}
      <Map
        ref={mapRef}
        initialViewState={initialView}
        onClick={handleMapClick}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        cursor="crosshair"
      >
        <NavigationControl position="bottom-right" />

        {/* User location marker */}
        {userLocation && (
          <Marker longitude={userLocation.longitude} latitude={userLocation.latitude}>
            <div className="flex h-4 w-4 items-center justify-center">
              <div className="h-3 w-3 rounded-full border-2 border-white bg-blue-500 shadow" />
            </div>
          </Marker>
        )}

        {/* Existing waypoints */}
        {existingWaypoints.map((wp, idx) => (
          <Marker key={`existing-${idx}`} longitude={wp.longitude} latitude={wp.latitude} anchor="center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-[11px] font-bold text-white shadow-lg border-2 border-white">
              {idx + 1}
            </div>
          </Marker>
        ))}

        {/* Pending point */}
        {pendingPoint && (
          <Marker longitude={pendingPoint.lng} latitude={pendingPoint.lat} anchor="bottom">
            <svg className="h-10 w-10 text-orange-500 drop-shadow-lg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" />
            </svg>
          </Marker>
        )}
      </Map>

      {/* Bottom panel — pending point confirmation */}
      {pendingPoint && (
        <div className="absolute bottom-0 left-0 right-0 z-10 rounded-t-2xl border-t border-card-border bg-card-bg/95 px-5 py-4 shadow-xl backdrop-blur-md">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600/15 text-orange-500">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              {loadingLabel ? (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin text-orange-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm text-muted">Szukam adresu...</span>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground truncate">
                    {reverseLabel?.split(',')[0] ?? `${pendingPoint.lat.toFixed(4)}, ${pendingPoint.lng.toFixed(4)}`}
                  </p>
                  {reverseLabel && reverseLabel.includes(',') && (
                    <p className="text-xs text-muted truncate mt-0.5">
                      {reverseLabel.split(',').slice(1).join(',').trim()}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setPendingPoint(null); setReverseLabel(null); }}
              className="flex-1 rounded-xl border border-card-border bg-card-bg py-2.5 text-xs font-semibold text-muted transition hover:bg-input-bg hover:text-foreground"
            >
              Anuluj
            </button>
            <button
              onClick={handleAddAndContinue}
              disabled={loadingLabel}
              className="flex-1 rounded-xl border border-orange-500/30 bg-orange-500/10 py-2.5 text-xs font-semibold text-orange-400 transition hover:bg-orange-500/20 disabled:opacity-50"
            >
              Dodaj i kontynuuj
            </button>
            <button
              onClick={handleAddAndClose}
              disabled={loadingLabel}
              className="flex-1 rounded-xl bg-orange-600 py-2.5 text-xs font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
            >
              Dodaj i wróć
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
