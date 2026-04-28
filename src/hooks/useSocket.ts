'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useMapStore } from '@/stores/useMapStore';
import { useConvoyStore } from '@/stores/useConvoyStore';
import { useSpotStore } from '@/stores/useSpotStore';
import { useSession } from 'next-auth/react';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ConvoyMember, Report, FuelStation } from '@/stores/useMapStore';
import type { ConvoyMemberInfo } from '@/stores/useConvoyStore';
import type { Spot } from '@/types';

function decorateSpot(spot: Spot, meId: string | undefined): Spot {
  return {
    ...spot,
    isOwner: !!meId && spot.createdById === meId,
    isParticipant: !!meId && !!spot.participants?.some((p) => p.userId === meId && !p.leftAt),
  };
}

interface UseSocketOptions {
  url?: string;
  autoConnect?: boolean;
  auth?: Record<string, string>;
  convoyId?: string | null;
}

interface UseSocketReturn {
  socket: null;
  isConnected: boolean;
  emit: (event: string, data?: unknown) => void;
  connect: () => void;
  disconnect: () => void;
}

const CONVOY_EVENTS = new Set([
  'join-convoy', 'leave-convoy', 'location-update',
  'convoy-destination-set', 'convoy-chat', 'convoy-voice',
  'convoy-message-delete', 'convoy-message-edit',
]);

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { autoConnect = true, convoyId } = options;

  const { data: session } = useSession();
  const meIdRef = useRef<string | undefined>(undefined);
  meIdRef.current = session?.user?.id as string | undefined;

  const [isConnected, setIsConnected] = useState(false);
  const publicChRef = useRef<RealtimeChannel | null>(null);
  const convoyChRef = useRef<RealtimeChannel | null>(null);
  const pendingConvoyEmitsRef = useRef<Array<{ event: string; payload: unknown }>>([]);

  const updateConvoyMember = useMapStore((s) => s.updateConvoyMember);
  const removeConvoyMember = useMapStore((s) => s.removeConvoyMember);
  const addReport = useMapStore((s) => s.addReport);
  const removeReport = useMapStore((s) => s.removeReport);
  const updateReportVotes = useMapStore((s) => s.updateReportVotes);
  const updateFuelStation = useMapStore((s) => s.updateFuelStation);
  const addSpot = useSpotStore((s) => s.addSpot);
  const upsertSpot = useSpotStore((s) => s.upsertSpot);
  const removeSpot = useSpotStore((s) => s.removeSpot);
  const convoyAddMember = useConvoyStore((s) => s.addMember);
  const convoyRemoveMember = useConvoyStore((s) => s.removeMember);
  const convoyUpdateMemberLocation = useConvoyStore((s) => s.updateMemberLocation);
  const convoySetMemberOnlineStatus = useConvoyStore((s) => s.setMemberOnlineStatus);
  const convoySetDestination = useConvoyStore((s) => s.setConvoyDestination);

  // Public channel — global events
  useEffect(() => {
    if (!autoConnect) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const ch = supabase.channel('public');

    ch.on('broadcast', { event: 'new-report' }, ({ payload }: { payload: Report }) => {
      addReport(payload);
    })
    .on('broadcast', { event: 'remove-report' }, ({ payload }: { payload: { reportId: string } }) => {
      removeReport(payload.reportId);
    })
    .on('broadcast', { event: 'report-vote' }, ({ payload }: { payload: { reportId: string; upvotes: number; downvotes: number } }) => {
      updateReportVotes(payload.reportId, payload.upvotes, payload.downvotes);
    })
    .on('broadcast', { event: 'fuel-price-update' }, ({ payload }: { payload: FuelStation }) => {
      updateFuelStation(payload);
    })
    .on('broadcast', { event: 'spot-created' }, ({ payload }: { payload: Spot }) => {
      addSpot(decorateSpot(payload, meIdRef.current));
    })
    .on('broadcast', { event: 'spot-updated' }, ({ payload }: { payload: Spot }) => {
      upsertSpot(decorateSpot(payload, meIdRef.current));
    })
    .on('broadcast', { event: 'spot-closed' }, ({ payload }: { payload: { spotId: string } }) => {
      removeSpot(payload.spotId);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        publicChRef.current = ch;
        setIsConnected(true);
      }
    });

    return () => {
      ch.unsubscribe();
      publicChRef.current = null;
      setIsConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect]);

  // Convoy channel — convoy-specific events
  useEffect(() => {
    if (!autoConnect || !convoyId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const ch = supabase.channel(`convoy:${convoyId}`);

    ch.on('broadcast', { event: 'location-update' }, ({ payload }: { payload: { memberId: string; latitude: number; longitude: number; heading?: number | null; speed?: number | null; name: string; avatarUrl?: string } }) => {
      if (payload.memberId === meIdRef.current) return;
      const member: ConvoyMember = {
        id: payload.memberId,
        name: payload.name,
        avatarUrl: payload.avatarUrl,
        latitude: payload.latitude,
        longitude: payload.longitude,
        heading: payload.heading,
        speed: payload.speed,
        lastUpdated: Date.now(),
      };
      updateConvoyMember(member);
      convoyUpdateMemberLocation(payload.memberId, payload.latitude, payload.longitude, payload.heading, payload.speed);
    })
    .on('broadcast', { event: 'join-convoy' }, ({ payload }: { payload: { userId: string; name?: string; avatarUrl?: string } }) => {
      if (payload.userId === meIdRef.current) return;
      const member: ConvoyMemberInfo = {
        id: payload.userId,
        userId: payload.userId,
        name: payload.name ?? 'Unknown',
        avatarUrl: payload.avatarUrl,
        role: 'MEMBER',
        latitude: 0,
        longitude: 0,
        joinedAt: Date.now(),
        lastUpdated: Date.now(),
        isOnline: true,
      };
      convoyAddMember(member);
    })
    .on('broadcast', { event: 'leave-convoy' }, ({ payload }: { payload: { userId: string } }) => {
      if (payload.userId === meIdRef.current) return;
      convoyRemoveMember(payload.userId);
      removeConvoyMember(payload.userId);
    })
    .on('broadcast', { event: 'convoy-destination-set' }, ({ payload }: { payload: { destLat: number | null; destLng: number | null; destName: string | null } }) => {
      convoySetDestination(payload.destLat, payload.destLng, payload.destName);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        convoyChRef.current = ch;
        // Flush any emits that arrived before subscription was ready
        for (const { event, payload } of pendingConvoyEmitsRef.current) {
          ch.send({ type: 'broadcast', event, payload });
        }
        pendingConvoyEmitsRef.current = [];
      }
    });

    return () => {
      ch.unsubscribe();
      convoyChRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect, convoyId]);

  const emit = useCallback((event: string, data?: unknown) => {
    const payload = (data ?? {}) as Record<string, unknown>;
    if (CONVOY_EVENTS.has(event)) {
      if (convoyChRef.current) {
        convoyChRef.current.send({ type: 'broadcast', event, payload });
      } else {
        pendingConvoyEmitsRef.current.push({ event, payload });
      }
    } else {
      publicChRef.current?.send({ type: 'broadcast', event, payload });
    }
  }, []);

  const connect = useCallback(() => {}, []);

  const disconnect = useCallback(() => {
    publicChRef.current?.unsubscribe();
    convoyChRef.current?.unsubscribe();
  }, []);

  // Suppress unused warning
  void convoySetMemberOnlineStatus;

  return { socket: null, isConnected, emit, connect, disconnect };
}
