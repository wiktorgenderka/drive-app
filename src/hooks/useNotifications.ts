'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/Toast';

interface UseNotificationsOptions {
  userId: string | null | undefined;
  convoyId?: string | null;
}

export function useNotifications({ userId, convoyId }: UseNotificationsOptions) {
  const { addToast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;

  const convoyIdRef = useRef(convoyId);
  convoyIdRef.current = convoyId;

  const handleConvoyUpdate = useCallback((data: { type: string; member?: { name?: string }; memberId?: string; memberName?: string }) => {
    if (data.type === 'member-joined' && data.member?.name) {
      addToastRef.current('info', `${data.member.name} dołączył(a) do konwoju`);
    } else if (data.type === 'member-left' && data.memberName) {
      addToastRef.current('info', `${data.memberName} opuścił(a) konwój`);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    const url = process.env.NEXT_PUBLIC_SOCKET_URL || '';
    const socket = io(url, {
      path: '/api/socketio',
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('user-connect', { userId });
      if (convoyIdRef.current) {
        socket.emit('join-convoy-notify', { convoyId: convoyIdRef.current });
      }
    });

    socket.on('friend-request', (data: { fromName: string }) => {
      addToastRef.current('info', `${data.fromName} zaprasza Cię do znajomych`);
    });

    socket.on('convoy-invite', (data: { convoyName: string; invitedByName: string }) => {
      addToastRef.current('info', `${data.invitedByName} zaprosił(a) Cię do konwoju „${data.convoyName}"`);
    });

    socket.on('friend-accepted', (data: { fromName: string }) => {
      addToastRef.current('success', `${data.fromName} zaakceptował(a) Twoje zaproszenie`);
    });

    socket.on('convoy-update', handleConvoyUpdate);

    socket.on('convoy-destination-set', (data: { destName?: string | null }) => {
      const label = data.destName ? `Cel konwoju: ${data.destName}` : 'Cel konwoju został zaktualizowany';
      addToastRef.current('info', label);
    });

    socket.on('new-report', () => {
      addToastRef.current('warning', 'Nowy raport drogowy w pobliżu');
    });

    socket.connect();
    socketRef.current = socket;

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Join convoy room when convoyId changes without full reconnect
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected || !convoyId) return;
    socket.emit('join-convoy-notify', { convoyId });
  }, [convoyId]);
}
