'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMapStore } from '@/stores/useMapStore';

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

      setState({
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
        error: null,
        isTracking: true,
      });

      setUserLocation({
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
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
