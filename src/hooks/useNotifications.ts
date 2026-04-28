'use client';

import { useEffect, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useMapStore } from '@/stores/useMapStore';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { FriendLocation } from '@/stores/useMapStore';

interface UseNotificationsOptions {
  userId: string | null | undefined;
  convoyId?: string | null;
}

export function useNotifications({ userId, convoyId }: UseNotificationsOptions) {
  const { addToast } = useToast();
  const addToastRef = useRef(addToast);
  addToastRef.current = addToast;

  const convoyIdRef = useRef(convoyId);
  convoyIdRef.current = convoyId;

  // Personal notifications channel (user:${userId})
  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const ch = supabase.channel(`user:${userId}`);

    ch.on('broadcast', { event: 'friend-request' }, ({ payload }: { payload: { fromName: string } }) => {
      addToastRef.current('info', `${payload.fromName} zaprasza Cię do znajomych`);
    })
    .on('broadcast', { event: 'friend-accepted' }, ({ payload }: { payload: { fromName: string } }) => {
      addToastRef.current('success', `${payload.fromName} zaakceptował(a) Twoje zaproszenie`);
    })
    .on('broadcast', { event: 'convoy-invite' }, ({ payload }: { payload: { convoyName: string; invitedByName: string } }) => {
      addToastRef.current('info', `${payload.invitedByName} zaprosił(a) Cię do konwoju „${payload.convoyName}"`);
    })
    .on('broadcast', { event: 'friend-location-update' }, ({ payload }: { payload: Omit<FriendLocation, 'updatedAt'> }) => {
      useMapStore.getState().setFriendLocation({ ...payload, updatedAt: Date.now() });
    })
    .subscribe();

    return () => { ch.unsubscribe(); };
  }, [userId]);

  // Convoy notifications channel (convoy:${convoyId})
  useEffect(() => {
    if (!convoyId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const ch = supabase.channel(`notif:convoy:${convoyId}`);

    ch.on('broadcast', { event: 'join-convoy' }, ({ payload }: { payload: { name?: string } }) => {
      if (payload.name) addToastRef.current('info', `${payload.name} dołączył(a) do konwoju`);
    })
    .on('broadcast', { event: 'leave-convoy' }, ({ payload }: { payload: { name?: string } }) => {
      if (payload.name) addToastRef.current('info', `${payload.name} opuścił(a) konwój`);
    })
    .on('broadcast', { event: 'convoy-destination-set' }, ({ payload }: { payload: { destName?: string | null } }) => {
      const label = payload.destName ? `Cel konwoju: ${payload.destName}` : 'Cel konwoju został zaktualizowany';
      addToastRef.current('info', label);
    })
    .on('broadcast', { event: 'new-report' }, () => {
      addToastRef.current('warning', 'Nowy raport drogowy w pobliżu');
    })
    .subscribe();

    return () => { ch.unsubscribe(); };
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
