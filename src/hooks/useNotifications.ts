'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/Toast';
import { useMapStore } from '@/stores/useMapStore';
import type { FriendLocation } from '@/stores/useMapStore';

interface UseNotificationsOptions {
  userId: string | null | undefined;
  convoyId?: string | null;
}

export function useNotifications({ userId, convoyId }: UseNotificationsOptions) {
  const { addToast } = useToast();
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;

  const socketRef = useRef<Socket | null>(null);
  const convoyIdRef = useRef(convoyId);
  convoyIdRef.current = convoyId;

  useEffect(() => {
    if (!userId) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[useNotifications] connected as', socket.id, 'userId:', userId);
      socket.emit('user-connect', { userId });
      if (convoyIdRef.current) {
        socket.emit('join-convoy-notify', { convoyId: convoyIdRef.current });
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[useNotifications] connect_error:', err.message);
    });

    socket.on('friend-request', (data: { fromName: string }) => {
      console.log('[useNotifications] friend-request from', data.fromName);
      addToastRef.current('info', `${data.fromName} zaprasza Cię do znajomych`);
    });

    socket.on('friend-accepted', (data: { fromName: string }) => {
      console.log('[useNotifications] friend-accepted from', data.fromName);
      addToastRef.current('success', `${data.fromName} zaakceptował(a) Twoje zaproszenie`);
    });

    socket.on('convoy-invite', (data: { convoyName: string; invitedByName: string }) => {
      console.log('[useNotifications] convoy-invite', data);
      addToastRef.current('info', `${data.invitedByName} zaprosił(a) Cię do konwoju „${data.convoyName}"`);
    });

    socket.on('convoy-update', (data: { type: string; member?: { name?: string }; memberName?: string }) => {
      if (data.type === 'member-joined' && data.member?.name) {
        addToastRef.current('info', `${data.member.name} dołączył(a) do konwoju`);
      } else if (data.type === 'member-left' && data.memberName) {
        addToastRef.current('info', `${data.memberName} opuścił(a) konwój`);
      }
    });

    socket.on('convoy-destination-set', (data: { destName?: string | null }) => {
      const label = data.destName ? `Cel konwoju: ${data.destName}` : 'Cel konwoju został zaktualizowany';
      addToastRef.current('info', label);
    });

    socket.on('new-report', () => {
      addToastRef.current('warning', 'Nowy raport drogowy w pobliżu');
    });

    socket.on('friend-location-update', (data: Omit<FriendLocation, 'updatedAt'>) => {
      useMapStore.getState().setFriendLocation({ ...data, updatedAt: Date.now() });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Join/re-join convoy room when convoyId changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected || !convoyId) return;
    socket.emit('join-convoy-notify', { convoyId });
  }, [convoyId]);

  // Remove stale friend markers (no update for > 5 min)
  useEffect(() => {
    if (!userId) return;
    const STALE_MS = 5 * 60 * 1000;
    const interval = setInterval(() => {
      const locs = useMapStore.getState().friendLocations;
      const now = Date.now();
      for (const [uid, loc] of Object.entries(locs)) {
        if (now - loc.updatedAt > STALE_MS) {
          useMapStore.getState().removeFriendLocation(uid);
        }
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [userId]);
}
