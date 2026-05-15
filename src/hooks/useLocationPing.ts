'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useMapStore } from '@/stores/useMapStore';
import { useProfileStore } from '@/stores/useProfileStore';
import { haversineMeters } from '@/lib/geo';

const PING_INTERVAL_MS = 10_000;
const PING_INTERVAL_ECO_MS = 30_000;
const MIN_DISTANCE_M = 5;

/**
 * Periodically pushes the current location + speed to the server so
 * `/api/friends/online` and the auto-spot detection can see fresh data.
 */
export function useLocationPing(enabled: boolean = true) {
  const { data: session } = useSession();
  const userLocation = useMapStore((s) => s.userLocation);
  const ecoMode = useMapStore((s) => s.ecoMode);
  const shareLocation = useProfileStore((s) => s.privacy.shareLocation);
  const lastSentRef = useRef<{ lat: number; lng: number; t: number } | null>(null);

  useEffect(() => {
    if (!enabled || !session?.user?.id) return;

    const intervalMs = ecoMode ? PING_INTERVAL_ECO_MS : PING_INTERVAL_MS;
    let cancelled = false;

    const ping = async () => {
      const loc = useMapStore.getState().userLocation;
      if (!loc) return;
      const last = lastSentRef.current;
      const now = Date.now();
      if (
        last &&
        now - last.t < intervalMs &&
        haversineMeters(last.lat, last.lng, loc.latitude, loc.longitude) < MIN_DISTANCE_M
      ) {
        return;
      }
      try {
        await fetch('/api/users/me/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: loc.latitude,
            longitude: loc.longitude,
            speed: loc.speed ?? null,
            share: shareLocation,
          }),
        });
        if (!cancelled) {
          lastSentRef.current = {
            lat: loc.latitude,
            lng: loc.longitude,
            t: now,
          };
        }
      } catch {
        // Silent — next tick will retry.
      }
    };

    // First ping as soon as we have a location.
    if (userLocation) ping();

    const interval = setInterval(ping, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // userLocation intentionally not a dep — reading via getState() each tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, session?.user?.id, shareLocation, ecoMode]);
}
