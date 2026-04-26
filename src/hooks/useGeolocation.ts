'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import { haversineMeters } from '@/lib/geo';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  error: string | null;
  isTracking: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
  autoStart?: boolean;
}

const defaultOptions: UseGeolocationOptions = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 15000,
  autoStart: true,
};

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const mergedOptions = { ...defaultOptions, ...options };
  const setUserLocation = useMapStore((state) => state.setUserLocation);
  const watchIdRef = useRef<number | null>(null);
  // Poprzedni fix do liczenia prędkości gdy GeolocationPosition.coords.speed jest null/0
  // (typowe dla przeglądarek na desktopie / bez sprzętowego GPS).
  const lastFixRef = useRef<{ lat: number; lng: number; t: number; accuracy: number } | null>(null);
  // Wygładzanie prędkości — średnia ruchoma z ostatnich 3 fixów eliminuje skoki
  // typowe dla pozycjonowania WiFi (lokalizacja "teleportuje się" o 30-100 m).
  const speedHistoryRef = useRef<number[]>([]);

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    heading: null,
    speed: null,
    error: null,
    isTracking: false,
  });

  const handleSuccess = useCallback(
    (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy, heading, speed } =
        position.coords;

      // Fallback dla braku natywnej prędkości — Δdystansu / Δczasu w m/s.
      let effectiveSpeed: number | null = speed != null && speed > 0 ? speed : null;
      const prev = lastFixRef.current;
      if (effectiveSpeed === null && prev) {
        const dtSec = (position.timestamp - prev.t) / 1000;
        if (dtSec >= 0.5 && dtSec <= 30) {
          const dist = haversineMeters(prev.lat, prev.lng, latitude, longitude);
          // Próg ruchu uzależniony od dokładności fixu — przy WiFi (accuracy ~50 m)
          // ruch <25 m to najpewniej szum, nie prawdziwe przemieszczenie.
          const accForGate = Math.max(accuracy ?? 10, prev.accuracy);
          const minMove = Math.max(2, accForGate * 0.5);
          if (dist >= minMove) {
            const computed = dist / dtSec;
            if (computed <= 100) effectiveSpeed = computed;
          } else {
            effectiveSpeed = 0;
          }
        }
      }

      // Średnia ruchoma — wygładza pojedyncze skoki.
      if (effectiveSpeed !== null) {
        const hist = speedHistoryRef.current;
        hist.push(effectiveSpeed);
        if (hist.length > 3) hist.shift();
        effectiveSpeed = hist.reduce((s, v) => s + v, 0) / hist.length;
      } else {
        speedHistoryRef.current = [];
      }

      lastFixRef.current = { lat: latitude, lng: longitude, t: position.timestamp, accuracy: accuracy ?? 50 };

      setState({
        latitude,
        longitude,
        accuracy,
        heading,
        speed: effectiveSpeed,
        error: null,
        isTracking: true,
      });

      setUserLocation({
        latitude,
        longitude,
        accuracy,
        heading,
        speed: effectiveSpeed,
        timestamp: position.timestamp,
      });
    },
    [setUserLocation]
  );

  const handleError = useCallback((error: GeolocationPositionError) => {
    let message: string;
    switch (error.code) {
      case error.PERMISSION_DENIED:
        message = 'Brak zgody na dostęp do lokalizacji. Zezwól w ustawieniach przeglądarki dla tej strony.';
        break;
      case error.POSITION_UNAVAILABLE:
        message = 'Lokalizacja niedostępna. Sprawdź czy GPS / usługi lokalizacji systemu są włączone.';
        break;
      case error.TIMEOUT:
        message = 'Przekroczono czas oczekiwania na lokalizację.';
        break;
      default:
        message = 'Nieznany błąd geolokalizacji.';
    }
    setState((prev) => ({
      ...prev,
      error: message,
      isTracking: false,
    }));
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: 'Geolocation is not supported by this browser.',
        isTracking: false,
      }));
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: mergedOptions.enableHighAccuracy,
        maximumAge: mergedOptions.maximumAge,
        timeout: mergedOptions.timeout,
      }
    );

    setState((prev) => ({ ...prev, isTracking: true, error: null }));
  }, [handleSuccess, handleError, mergedOptions.enableHighAccuracy, mergedOptions.maximumAge, mergedOptions.timeout]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  useEffect(() => {
    if (mergedOptions.autoStart) {
      startTracking();
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    startTracking,
    stopTracking,
  };
}
