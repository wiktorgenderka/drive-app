'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useGeolocation } from './useGeolocation';
import { useSocket } from './useSocket';
import { haversineMeters } from '@/lib/geo';

interface UseRealTimeLocationOptions {
  /** Minimum distance in meters before broadcasting a new position */
  distanceThreshold?: number;
  /** Minimum interval in ms between broadcasts */
  broadcastInterval?: number;
  /** Geolocation high accuracy mode */
  enableHighAccuracy?: boolean;
}

const DEFAULT_DISTANCE_THRESHOLD = 5; // meters
const DEFAULT_BROADCAST_INTERVAL = 2000; // ms


export function useRealTimeLocation(
  convoyId: string | null,
  options: UseRealTimeLocationOptions = {}
) {
  const {
    distanceThreshold = DEFAULT_DISTANCE_THRESHOLD,
    broadcastInterval = DEFAULT_BROADCAST_INTERVAL,
    enableHighAccuracy = true,
  } = options;

  const { data: session } = useSession();
  const user = session?.user ?? null;

  const geo = useGeolocation({ enableHighAccuracy, autoStart: !!convoyId });
  const { emit, isConnected } = useSocket({ autoConnect: !!convoyId });

  const lastBroadcastRef = useRef<{
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null>(null);

  const broadcast = useCallback(
    (latitude: number, longitude: number, heading: number | null, speed: number | null) => {
      if (!convoyId || !user || !isConnected) return;

      const now = Date.now();
      const last = lastBroadcastRef.current;

      // Throttle: skip if too soon and position hasn't changed significantly
      if (last) {
        const timeDelta = now - last.timestamp;
        const distance = haversineMeters(
          last.latitude,
          last.longitude,
          latitude,
          longitude
        );

        if (timeDelta < broadcastInterval && distance < distanceThreshold) {
          return;
        }
      }

      emit('location-update', {
        convoyId,
        memberId: user.id,
        name: user.name,
        avatarUrl: user.image ?? undefined,
        latitude,
        longitude,
        heading,
        speed,
        timestamp: now,
      });

      lastBroadcastRef.current = { latitude, longitude, timestamp: now };
    },
    [convoyId, user, isConnected, emit, broadcastInterval, distanceThreshold]
  );

  // Broadcast whenever geolocation updates
  useEffect(() => {
    if (geo.latitude !== null && geo.longitude !== null) {
      broadcast(geo.latitude, geo.longitude, geo.heading, geo.speed);
    }
  }, [geo.latitude, geo.longitude, geo.heading, geo.speed, broadcast]);

  // Join/leave convoy room
  useEffect(() => {
    if (!convoyId || !isConnected) return;

    emit('join-convoy', { convoyId, userId: user?.id, name: user?.name, avatarUrl: user?.image ?? undefined });

    return () => {
      emit('leave-convoy', { convoyId, userId: user?.id, name: user?.name });
      lastBroadcastRef.current = null;
    };
  }, [convoyId, isConnected, emit, user?.id]);

  return {
    latitude: geo.latitude,
    longitude: geo.longitude,
    accuracy: geo.accuracy,
    heading: geo.heading,
    speed: geo.speed,
    error: geo.error,
    isTracking: geo.isTracking,
    isConnected,
    startTracking: geo.startTracking,
    stopTracking: geo.stopTracking,
  };
}
