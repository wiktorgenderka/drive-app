'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useMapStore } from '@/stores/useMapStore';
import { useSpotStore } from '@/stores/useSpotStore';
import { haversineMeters } from '@/lib/geo';

// Detection thresholds — must match server in /api/spots/auto-check.
const NEAR_DISTANCE_M = 50;
const STILL_SPEED_MPS = 2 / 3.6; // 2 km/h
// Rejection thresholds — when to leave a spot.
const FAR_DISTANCE_M = 200;
const MOVING_SPEED_MPS = 5 / 3.6; // 5 km/h

const TRIGGER_HOLD_MS = 60_000; // 60s of sustained eligibility
const POLL_INTERVAL_MS = 10_000;

interface FriendOnline {
  id: string;
  name: string;
  isOnline: boolean;
  latitude: number | null;
  longitude: number | null;
  speed: number | null;
  lastLocationUpdate: string | null;
}

/**
 * Auto-detects "spot" situations: two friends within NEAR_DISTANCE_M, both
 * stationary, sustained for TRIGGER_HOLD_MS — then asks the server to create
 * (or join) an auto-spot. Symmetrically leaves the spot when conditions
 * break for TRIGGER_HOLD_MS.
 */
export function useAutoSpotDetection(enabled: boolean = true) {
  const { data: session } = useSession();
  const meId = session?.user?.id;

  // Map<friendId, ms timestamp since pairing conditions started holding>.
  const pairSinceRef = useRef<Map<string, number>>(new Map());
  // Map<spotId, ms since the spot stopped being eligible>.
  const breakSinceRef = useRef<Map<string, number>>(new Map());
  // Map<friendId, ms timestamp of last successful auto-check call>.
  const lastTriggeredRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!enabled || !meId) return;

    let cancelled = false;

    const tick = async () => {
      const me = useMapStore.getState().userLocation;
      if (!me || me.speed == null) return;

      let friends: FriendOnline[];
      try {
        const res = await fetch('/api/friends/online');
        if (!res.ok) return;
        friends = await res.json();
      } catch {
        return;
      }
      if (cancelled) return;

      const onlineFriends = friends.filter(
        (f): f is FriendOnline & { latitude: number; longitude: number; speed: number } =>
          f.isOnline &&
          f.latitude != null &&
          f.longitude != null &&
          f.speed != null
      );

      const now = Date.now();
      const myLat = me.latitude;
      const myLng = me.longitude;
      const mySpeed = me.speed;

      // ── Detection: should we create/join an auto-spot with each friend? ──
      const activePartnerIds = new Set<string>();
      const spots = useSpotStore.getState().spots;
      for (const s of spots) {
        if (s.kind === 'AUTO' && s.isParticipant && s.participants) {
          for (const p of s.participants) {
            if (p.userId !== meId) activePartnerIds.add(p.userId);
          }
        }
      }

      for (const friend of onlineFriends) {
        if (activePartnerIds.has(friend.id)) {
          pairSinceRef.current.delete(friend.id);
          continue;
        }
        const distance = haversineMeters(myLat, myLng, friend.latitude, friend.longitude);
        const eligible =
          distance <= NEAR_DISTANCE_M &&
          mySpeed <= STILL_SPEED_MPS &&
          friend.speed <= STILL_SPEED_MPS;

        if (!eligible) {
          pairSinceRef.current.delete(friend.id);
          continue;
        }

        const since = pairSinceRef.current.get(friend.id) ?? now;
        pairSinceRef.current.set(friend.id, since);

        // Avoid spamming the endpoint while a previous request is still relevant.
        const lastTriggered = lastTriggeredRef.current.get(friend.id) ?? 0;
        const holdEnough = now - since >= TRIGGER_HOLD_MS;
        const cooldownPassed = now - lastTriggered > 30_000;

        if (holdEnough && cooldownPassed) {
          lastTriggeredRef.current.set(friend.id, now);
          try {
            await fetch('/api/spots/auto-check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                partnerUserId: friend.id,
                latitude: myLat,
                longitude: myLng,
                speed: mySpeed,
              }),
            });
          } catch {
            // Retry on next tick.
          }
        }
      }

      // ── Auto-leave: are the conditions still holding for spots I'm in? ──
      const friendById = new Map(onlineFriends.map((f) => [f.id, f]));
      for (const s of spots) {
        if (s.kind !== 'AUTO' || !s.isParticipant || !s.participants) continue;

        const partners = s.participants
          .filter((p) => p.userId !== meId)
          .map((p) => friendById.get(p.userId))
          .filter((p): p is NonNullable<typeof p> => !!p);

        if (partners.length === 0) {
          // No partner online — hold position for now.
          breakSinceRef.current.delete(s.id);
          continue;
        }

        const stillTogether = partners.some((p) => {
          const d = haversineMeters(myLat, myLng, p.latitude, p.longitude);
          return d <= FAR_DISTANCE_M && mySpeed <= MOVING_SPEED_MPS && p.speed <= MOVING_SPEED_MPS;
        });

        if (stillTogether) {
          breakSinceRef.current.delete(s.id);
          continue;
        }

        const since = breakSinceRef.current.get(s.id) ?? now;
        breakSinceRef.current.set(s.id, since);

        if (now - since >= TRIGGER_HOLD_MS) {
          breakSinceRef.current.delete(s.id);
          try {
            await fetch(`/api/spots/${s.id}/leave`, { method: 'POST' });
          } catch {
            // Silent.
          }
        }
      }
    };

    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, meId]);
}
