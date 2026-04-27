'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMapStore } from '@/stores/useMapStore';
import { useConvoyStore } from '@/stores/useConvoyStore';
import { useSpotStore } from '@/stores/useSpotStore';
import { useAuthStore } from '@/stores/useAuthStore';
import type { ConvoyMember, Report, FuelStation } from '@/stores/useMapStore';
import type { ConvoyMemberInfo } from '@/stores/useConvoyStore';
import type { Spot } from '@/types';

function decorateSpot(spot: Spot, meId: string | undefined): Spot {
  return {
    ...spot,
    isOwner: !!meId && spot.createdById === meId,
    isParticipant:
      !!meId &&
      !!spot.participants?.some((p) => p.userId === meId && !p.leftAt),
  };
}

interface UseSocketOptions {
  url?: string;
  autoConnect?: boolean;
  auth?: Record<string, string>;
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  emit: (event: string, ...args: unknown[]) => void;
  connect: () => void;
  disconnect: () => void;
}

const RECONNECT_DELAY_BASE = 1000;
const RECONNECT_DELAY_MAX = 30000;
const RECONNECT_ATTEMPTS_MAX = 10;

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    url = process.env.NEXT_PUBLIC_SOCKET_URL || '',
    autoConnect = true,
    auth,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [isConnected, setIsConnected] = useState(false);

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

  const setupEventHandlers = useCallback(
    (socket: Socket) => {
      socket.on('connect', () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });

      socket.on('connect_error', () => {
        setIsConnected(false);
      });

      // Location updates from other convoy members
      socket.on(
        'location-update',
        (data: {
          memberId: string;
          latitude: number;
          longitude: number;
          heading?: number | null;
          speed?: number | null;
          name: string;
          avatarUrl?: string;
        }) => {
          const member: ConvoyMember = {
            id: data.memberId,
            name: data.name,
            avatarUrl: data.avatarUrl,
            latitude: data.latitude,
            longitude: data.longitude,
            heading: data.heading,
            speed: data.speed,
            lastUpdated: Date.now(),
          };
          updateConvoyMember(member);
          convoyUpdateMemberLocation(
            data.memberId,
            data.latitude,
            data.longitude,
            data.heading,
            data.speed
          );
        }
      );

      // New road report
      socket.on('new-report', (report: Report) => {
        addReport(report);
      });

      // Report removed / expired
      socket.on('remove-report', (data: { reportId: string }) => {
        removeReport(data.reportId);
      });

      // Report vote update
      socket.on(
        'report-vote',
        (data: { reportId: string; upvotes: number; downvotes: number }) => {
          updateReportVotes(data.reportId, data.upvotes, data.downvotes);
        }
      );

      // Convoy membership changes
      socket.on('convoy-update', (data: { type: string; member?: ConvoyMemberInfo; memberId?: string }) => {
        switch (data.type) {
          case 'member-joined':
            if (data.member) convoyAddMember(data.member);
            break;
          case 'member-left':
            if (data.memberId) {
              convoyRemoveMember(data.memberId);
              removeConvoyMember(data.memberId);
            }
            break;
          case 'member-online':
            if (data.memberId) convoySetMemberOnlineStatus(data.memberId, true);
            break;
          case 'member-offline':
            if (data.memberId) convoySetMemberOnlineStatus(data.memberId, false);
            break;
        }
      });

      // Fuel station price updates
      socket.on('fuel-price-update', (station: FuelStation) => {
        updateFuelStation(station);
      });

      // Spot created (manual or auto)
      socket.on('spot-created', (spot: Spot) => {
        const meId = useAuthStore.getState().user?.id;
        addSpot(decorateSpot(spot, meId));
      });

      // Spot updated (e.g. participants joined)
      socket.on('spot-updated', (spot: Spot) => {
        const meId = useAuthStore.getState().user?.id;
        upsertSpot(decorateSpot(spot, meId));
      });

      // Spot closed by owner / auto-expired
      socket.on('spot-closed', (data: { spotId: string }) => {
        removeSpot(data.spotId);
      });

      // Convoy shared destination update
      socket.on('convoy-destination-set', (data: { convoyId: string; destLat: number | null; destLng: number | null; destName: string | null }) => {
        convoySetDestination(data.destLat, data.destLng, data.destName);
      });
    },
    [
      updateConvoyMember,
      removeConvoyMember,
      addReport,
      removeReport,
      updateReportVotes,
      updateFuelStation,
      addSpot,
      upsertSpot,
      removeSpot,
      convoyAddMember,
      convoyRemoveMember,
      convoyUpdateMemberLocation,
      convoySetMemberOnlineStatus,
      convoySetDestination,
    ]
  );

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(url, {
      autoConnect: false,
      auth,
      reconnection: true,
      reconnectionAttempts: RECONNECT_ATTEMPTS_MAX,
      reconnectionDelay: RECONNECT_DELAY_BASE,
      reconnectionDelayMax: RECONNECT_DELAY_MAX,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    });

    setupEventHandlers(socket);
    socket.connect();
    socketRef.current = socket;
  }, [url, auth, setupEventHandlers]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, ...args);
    }
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    emit,
    connect,
    disconnect,
  };
}
