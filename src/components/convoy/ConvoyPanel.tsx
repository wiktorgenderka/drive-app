'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getSupabaseClient } from '@/lib/supabase-client';
import { useMapStore } from '@/stores/useMapStore';
import CreateConvoyModal from './CreateConvoyModal';
import InviteFriendModal from './InviteFriendModal';
import ConvoyChat from './ConvoyChat';
import ConvoyDriveMode from './ConvoyDriveMode';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(toRad((lat2 - lat1) / 2)) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad((lon2 - lon1) / 2)) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatETA(distKm: number, speedKmh: number | null): string {
  const speed = speedKmh && speedKmh > 5 ? speedKmh : 60;
  const minutes = Math.round((distKm / speed) * 60);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface ConvoyMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

interface Convoy {
  id: string;
  name: string;
  ownerId: string;
  destLat?: number | null;
  destLng?: number | null;
  destName?: string | null;
  members: ConvoyMember[];
}

interface Props {
  mapVoiceEnabled: boolean;
  onToggleMapVoice: (val: boolean) => void;
  mapNotificationsEnabled: boolean;
  onToggleMapNotifications: (val: boolean) => void;
  onEnterDriveMode: () => void;
}

export default function ConvoyPanel({ mapVoiceEnabled, onToggleMapVoice, mapNotificationsEnabled, onToggleMapNotifications, onEnterDriveMode }: Props) {
  const { data: session } = useSession();
  const liveMembers = useMapStore((s) => s.convoyMembers);
  const userLocation = useMapStore((s) => s.userLocation);
  const [convoys, setConvoys] = useState<Convoy[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [inviteConvoyId, setInviteConvoyId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [destConvoyId, setDestConvoyId] = useState<string | null>(null);
  const [destInput, setDestInput] = useState('');
  const [driveModeConvoy, setDriveModeConvoy] = useState<Convoy | null>(null);
  interface MemberStats { userId: string; name: string; image: string | null; totalKm: number; maxSpeedKmh: number; tripCount: number; }
  const [postConvoyStats, setPostConvoyStats] = useState<{
    name: string; memberCount: number; destName: string | null;
    members: MemberStats[]; totalKm: number;
  } | null>(null);
  const [joinedAtMap, setJoinedAtMap] = useState<Record<string, number>>({});
  const [shareRouteConvoyId, setShareRouteConvoyId] = useState<string | null>(null);
  const [myRoutes, setMyRoutes] = useState<{ id: string; name: string; description?: string | null }[]>([]);
  const [sharedRouteNotif, setSharedRouteNotif] = useState<{ convoyId: string; routeName: string } | null>(null);

  const fetchConvoys = useCallback(async () => {
    try {
      const res = await fetch('/api/convoy');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConvoys(Array.isArray(data) ? data : data.convoys ?? []);
    } catch {
      setError('Nie udaĹ‚o siÄ™ zaĹ‚adowaÄ‡ konwojĂłw.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConvoys();
  }, [fetchConvoys]);

  // Fetch user routes when route picker opens
  useEffect(() => {
    if (!shareRouteConvoyId) return;
    fetch('/api/routes?limit=20')
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((d) => setMyRoutes(d.data ?? d ?? []))
      .catch(() => {});
  }, [shareRouteConvoyId]);

  // Listen for shared route events from convoy leader
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase || convoys.length === 0) return;
    const channels = convoys.map((c) => {
      const ch = supabase.channel(`convoy:${c.id}:routes`);
      ch.on('broadcast', { event: 'convoy-route-shared' }, (payload) => {
        const { routeName } = payload.payload as { routeName: string };
        setSharedRouteNotif({ convoyId: c.id, routeName });
        setTimeout(() => setSharedRouteNotif(null), 8000);
      }).subscribe();
      return ch;
    });
    return () => { channels.forEach((ch) => ch.unsubscribe()); };
  }, [convoys]);

  // Record join time for each convoy (for post-convoy stats)
  useEffect(() => {
    setJoinedAtMap((prev) => {
      const next = { ...prev };
      for (const c of convoys) {
        if (!next[c.id]) next[c.id] = Date.now();
      }
      return next;
    });
  }, [convoys]);

  const leaveOrDelete = async (convoy: Convoy) => {
    const isOwner = convoy.ownerId === session?.user?.id;
    const action = isOwner ? 'usunÄ…Ä‡' : 'opuĹ›ciÄ‡';
    if (!confirm(`Czy na pewno chcesz ${action} konwĂłj "${convoy.name}"?`)) return;

    setActionLoading(convoy.id);
    const joinedAt = joinedAtMap[convoy.id];
    const showStats = joinedAt && Date.now() - joinedAt > 5 * 60_000;

    try {
      // Fetch trip stats before deleting (they reference convoyId)
      const tripStatsRes = showStats ? await fetch(`/api/convoy/${convoy.id}/trips`) : null;
      const tripStats = tripStatsRes?.ok ? await tripStatsRes.json() : null;

      const res = await fetch(`/api/convoy?convoyId=${convoy.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();

      if (showStats) {
        setPostConvoyStats({
          name: convoy.name,
          memberCount: convoy.members.length,
          destName: convoy.destName ?? null,
          members: tripStats?.members ?? [],
          totalKm: tripStats?.totalKm ?? 0,
        });
      }
      await fetchConvoys();
    } catch {
      setError('Operacja nie powiodĹ‚a siÄ™.');
    } finally {
      setActionLoading(null);
    }
  };

  const setDestination = async (convoyId: string, destName: string) => {
    if (!destName.trim()) return;
    setActionLoading(`dest-${convoyId}`);
    try {
      // Geocode the destination name using Mapbox
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(destName.trim())}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&limit=1&language=pl`
      );
      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) {
        setError('Nie znaleziono lokalizacji.');
        return;
      }
      const [destLng, destLat] = feature.center as [number, number];
      const resolvedName: string = feature.place_name ?? destName.trim();

      const updateRes = await fetch(`/api/convoy/${convoyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destLat, destLng, destName: resolvedName }),
      });
      if (!updateRes.ok) throw new Error();

      // Broadcast destination update to convoy members via Supabase Realtime
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.channel(`convoy:${convoyId}`).send({
          type: 'broadcast',
          event: 'convoy-destination-set',
          payload: { convoyId, destLat, destLng, destName: resolvedName },
        });
      }

      setDestConvoyId(null);
      setDestInput('');
      await fetchConvoys();
    } catch {
      setError('Nie udaĹ‚o siÄ™ ustawiÄ‡ celu.');
    } finally {
      setActionLoading(null);
    }
  };

  async function shareRoute(convoyId: string, routeId: string, routeName: string) {
    setActionLoading(`route-${convoyId}`);
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.channel(`convoy:${convoyId}:routes`).send({
          type: 'broadcast',
          event: 'convoy-route-shared',
          payload: { routeId, routeName },
        });
      }
    } catch { /* silent */ }
    setShareRouteConvoyId(null);
    setActionLoading(null);
  }

  const currentUserId = session?.user?.id;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Twoje konwoje</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              showSettings
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                : 'border-card-border bg-input-bg text-muted hover:text-foreground'
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-fg transition hover:opacity-90"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            UtwĂłrz
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="rounded-2xl border border-card-border bg-card-bg p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Ustawienia konwoju</h3>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">Przycisk gĹ‚osowy na mapie</span>
                <span className="text-xs text-muted">Szybkie nagrywanie bez wychodzenia z mapy</span>
              </div>
              <button
                onClick={() => onToggleMapVoice(!mapVoiceEnabled)}
                role="switch"
                aria-checked={mapVoiceEnabled}
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                  mapVoiceEnabled ? 'bg-emerald-600' : 'bg-zinc-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    mapVoiceEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">Powiadomienia na mapie</span>
                <span className="text-xs text-muted">Pokazuj wiadomoĹ›ci konwoju podczas jazdy</span>
              </div>
              <button
                onClick={() => onToggleMapNotifications(!mapNotificationsEnabled)}
                role="switch"
                aria-checked={mapNotificationsEnabled}
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                  mapNotificationsEnabled ? 'bg-emerald-600' : 'bg-zinc-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                    mapNotificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-300 hover:text-red-200">âś•</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <svg className="h-6 w-6 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Empty state */}
      {!loading && convoys.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-card-border bg-card-bg py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-500">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <path d="M16 8h4l3 3v5a1 1 0 01-1 1h-2" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Brak konwojĂłw</p>
            <p className="mt-0.5 text-xs text-muted">UtwĂłrz konwĂłj i zaproĹ› znajomych!</p>
          </div>
        </div>
      )}

      {/* Convoy list */}
      {!loading && convoys.length > 0 && (
        <div className="flex flex-col gap-3">
          {convoys.map((convoy) => {
            const isOwner = convoy.ownerId === currentUserId;
            const memberCount = convoy.members.length;
            const isExpanded = expandedId === convoy.id;

            return (
              <div
                key={convoy.id}
                className="overflow-hidden rounded-2xl border border-card-border bg-card-bg"
              >
                {/* Convoy header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : convoy.id)}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-input-bg/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-500">
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <rect x="1" y="3" width="15" height="13" rx="2" />
                        <path d="M16 8h4l3 3v5a1 1 0 01-1 1h-2" />
                        <circle cx="5.5" cy="18.5" r="2.5" />
                        <circle cx="18.5" cy="18.5" r="2.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{convoy.name}</p>
                      <p className="text-xs text-muted">
                        {memberCount} {memberCount === 1 ? 'czĹ‚onek' : memberCount < 5 ? 'czĹ‚onkĂłw' : 'czĹ‚onkĂłw'}
                        {isOwner && <span className="ml-1.5 text-emerald-500">Â· Lider</span>}
                      </p>
                    </div>
                  </div>
                  <svg
                    className={`h-4 w-4 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-card-border px-4 py-3">
                    {/* Member list with live ETA */}
                    {convoy.members.length === 0 ? (
                      <p className="py-2 text-center text-xs text-muted">Brak czĹ‚onkĂłw.</p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {convoy.members.map((member) => {
                          const live = liveMembers.find((m) => m.id === member.userId);
                          const isMe = member.userId === currentUserId;
                          const loc = isMe ? userLocation : live;
                          const hasDest = convoy.destLat != null && convoy.destLng != null;
                          const distKm = hasDest && loc
                            ? haversineKm(loc.latitude, loc.longitude, convoy.destLat!, convoy.destLng!)
                            : null;
                          const speed = live?.speed ?? (isMe ? userLocation?.speed ?? null : null);
                          const isOnline = live != null || isMe;
                          const lastSeen = live ? Math.floor((Date.now() - live.lastUpdated) / 1000) : 0;

                          return (
                            <li key={member.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-input-bg/50">
                              {/* Avatar with online dot */}
                              <div className="relative shrink-0">
                                {member.user.image ? (
                                  <img
                                    src={member.user.image}
                                    alt={member.user.name}
                                    className="h-8 w-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/20 text-xs font-semibold text-emerald-400">
                                    {member.user.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card-bg ${
                                  isOnline && lastSeen < 60 ? 'bg-emerald-500' : 'bg-zinc-600'
                                }`} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-foreground">{member.user.name}</p>
                                {/* Speed indicator */}
                                {speed != null && speed > 1 && (
                                  <p className="text-[11px] text-muted tabular-nums">
                                    {Math.round(speed * 3.6)} km/h
                                  </p>
                                )}
                              </div>

                              {/* ETA badge */}
                              {distKm !== null && (
                                <div className="flex flex-col items-end">
                                  <span className="text-xs font-bold text-accent tabular-nums">
                                    {distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`}
                                  </span>
                                  <span className="text-[10px] text-muted tabular-nums">
                                    {formatETA(distKm, speed ? speed * 3.6 : null)}
                                  </span>
                                </div>
                              )}

                              {/* Role / Me badges (when no ETA) */}
                              {distKm === null && member.role === 'OWNER' && (
                                <span className="rounded-md bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                  Lider
                                </span>
                              )}
                              {distKm === null && isMe && member.role !== 'OWNER' && (
                                <span className="rounded-md bg-blue-600/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                                  Ty
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* Shared destination */}
                    {convoy.destName && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2">
                        <svg className="h-3.5 w-3.5 shrink-0 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        <p className="flex-1 truncate text-xs text-blue-300">{convoy.destName}</p>
                        {isOwner && (
                          <button
                            onClick={() => { setDestConvoyId(convoy.id); setDestInput(''); }}
                            className="shrink-0 text-[10px] text-blue-400 hover:text-blue-300"
                          >
                            ZmieĹ„
                          </button>
                        )}
                      </div>
                    )}

                    {/* Set destination form (owner only) */}
                    {isOwner && destConvoyId === convoy.id && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={destInput}
                          onChange={(e) => setDestInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') setDestination(convoy.id, destInput); }}
                          placeholder="Cel podrĂłĹĽy (np. Warszawa)"
                          className="flex-1 rounded-xl border border-card-border bg-input-bg px-3 py-2 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => setDestination(convoy.id, destInput)}
                          disabled={actionLoading === `dest-${convoy.id}`}
                          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-accent-fg transition hover:bg-blue-700 disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setDestConvoyId(null)}
                          className="rounded-xl border border-card-border px-3 py-2 text-xs text-muted transition hover:bg-input-bg"
                        >
                          âś•
                        </button>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setInviteConvoyId(convoy.id)}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-card-border bg-input-bg px-3 py-2.5 text-xs font-semibold text-muted transition hover:bg-card-bg hover:text-foreground"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                          <circle cx="8.5" cy="7" r="4" />
                          <path d="M20 8v6M23 11h-6" />
                        </svg>
                        ZaproĹ›
                      </button>
                      {isOwner && !convoy.destName && destConvoyId !== convoy.id && (
                        <button
                          onClick={() => setDestConvoyId(convoy.id)}
                          className="flex items-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2.5 text-xs font-semibold text-blue-400 transition hover:bg-blue-500/20"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          Cel
                        </button>
                      )}
                      {isOwner && (
                        <button
                          onClick={() => setShareRouteConvoyId(convoy.id)}
                          disabled={actionLoading === `route-${convoy.id}`}
                          className="flex items-center gap-1 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2.5 text-xs font-semibold text-violet-400 transition hover:bg-violet-500/20 disabled:opacity-50"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          Trasa
                        </button>
                      )}
                      <button
                        onClick={() => setDriveModeConvoy(convoy)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-xs font-semibold text-accent-fg transition hover:opacity-90"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                        Czat
                      </button>
                      <button
                        onClick={() => { if (!mapVoiceEnabled) onToggleMapVoice(true); onEnterDriveMode(); }}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <rect x="1" y="3" width="15" height="13" rx="2" />
                          <path d="M16 8h4l3 3v5a1 1 0 01-1 1h-2" />
                          <circle cx="5.5" cy="18.5" r="2.5" />
                          <circle cx="18.5" cy="18.5" r="2.5" />
                        </svg>
                        JedĹş
                      </button>
                      <button
                        onClick={() => leaveOrDelete(convoy)}
                        disabled={actionLoading === convoy.id}
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {actionLoading === convoy.id ? '...' : isOwner ? 'UsuĹ„' : 'OpuĹ›Ä‡'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Drive mode overlay */}
      {driveModeConvoy && (
        <ConvoyDriveMode
          convoy={driveModeConvoy}
          onClose={() => setDriveModeConvoy(null)}
        />
      )}

      {/* Route picker modal */}
      {shareRouteConvoyId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShareRouteConvoyId(null)}>
          <div className="w-full max-w-lg rounded-t-3xl border border-card-border bg-card-bg p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 h-1 w-12 rounded-full bg-card-border mx-auto" />
            <h3 className="mt-3 mb-4 text-base font-bold text-foreground">UdostÄ™pnij trasÄ™ konwojowi</h3>
            {myRoutes.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Brak zapisanych tras. Najpierw stwĂłrz trasÄ™.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                {myRoutes.map((route) => (
                  <button
                    key={route.id}
                    onClick={() => shareRoute(shareRouteConvoyId, route.id, route.name)}
                    className="flex items-center gap-3 rounded-xl border border-card-border bg-input-bg px-4 py-3 text-left transition hover:border-violet-500/40 hover:bg-violet-500/5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600/15 text-violet-400">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{route.name}</p>
                      {route.description && (
                        <p className="truncate text-xs text-muted">{route.description}</p>
                      )}
                    </div>
                    <svg className="h-4 w-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setShareRouteConvoyId(null)}
              className="mt-4 w-full rounded-xl border border-card-border py-2.5 text-sm text-muted transition hover:text-foreground"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Shared route notification banner */}
      {sharedRouteNotif && (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-violet-500/30 bg-card-bg/95 px-4 py-3 shadow-xl backdrop-blur-md">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Lider udostÄ™pniĹ‚ trasÄ™</p>
              <p className="truncate text-xs text-violet-400 font-medium max-w-[200px]">{sharedRouteNotif.routeName}</p>
            </div>
            <button onClick={() => setSharedRouteNotif(null)} className="ml-1 text-muted hover:text-foreground">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Post-convoy stats overlay */}
      {postConvoyStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-3xl border border-card-border bg-card-bg shadow-2xl overflow-hidden">
            {/* Emerald accent top bar */}
            <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-500" />

            <div className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/20 text-2xl">đźŹ</div>
                <div>
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide">KonwĂłj zakoĹ„czony</p>
                  <h3 className="text-base font-bold text-foreground truncate">{postConvoyStats.name}</h3>
                </div>
              </div>

              {/* Summary row */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-xl bg-input-bg p-3 text-center">
                  <p className="text-lg font-black text-foreground">{postConvoyStats.memberCount}</p>
                  <p className="text-[10px] text-muted">uczestnikĂłw</p>
                </div>
                <div className="rounded-xl bg-input-bg p-3 text-center">
                  <p className="text-lg font-black text-accent tabular-nums">{postConvoyStats.totalKm.toFixed(1)}</p>
                  <p className="text-[10px] text-muted">km razem</p>
                </div>
                <div className="rounded-xl bg-input-bg p-3 text-center">
                  {postConvoyStats.destName ? (
                    <>
                      <p className="text-xs font-bold text-blue-400 truncate">{postConvoyStats.destName.split(',')[0]}</p>
                      <p className="text-[10px] text-muted">cel</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg">đź›Łď¸Ź</p>
                      <p className="text-[10px] text-muted">wolna trasa</p>
                    </>
                  )}
                </div>
              </div>

              {/* Member rankings */}
              {postConvoyStats.members.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">Ranking</p>
                  <div className="flex flex-col gap-1.5">
                    {postConvoyStats.members.slice(0, 5).map((m, i) => (
                      <div key={m.userId} className="flex items-center gap-2.5 rounded-xl bg-input-bg px-3 py-2">
                        <span className="text-sm font-black tabular-nums text-muted w-4">{i + 1}</span>
                        {m.image ? (
                          <img src={m.image} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-xs font-bold text-emerald-400">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <p className="flex-1 truncate text-sm font-semibold text-foreground">{m.name}</p>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-xs font-bold text-accent tabular-nums">{m.totalKm.toFixed(1)} km</p>
                            {m.maxSpeedKmh > 0 && (
                              <p className="text-[10px] text-muted tabular-nums">{Math.round(m.maxSpeedKmh)} km/h max</p>
                            )}
                          </div>
                          {i === 0 && <span className="text-base">đźĄ‡</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {postConvoyStats.members.length === 0 && (
                <p className="mb-4 text-center text-sm text-muted">Dobra jazda! XP zostaĹ‚y zapisane.</p>
              )}

              <button
                onClick={() => setPostConvoyStats(null)}
                className="w-full rounded-2xl bg-accent py-3 text-sm font-bold text-accent-fg transition hover:opacity-90"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create modal */}
      <CreateConvoyModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          fetchConvoys();
        }}
      />

      {/* Invite modal */}
      {inviteConvoyId && (
        <InviteFriendModal
          open={!!inviteConvoyId}
          convoyId={inviteConvoyId}
          existingMemberIds={
            convoys.find((c) => c.id === inviteConvoyId)?.members.map((m) => m.userId) ?? []
          }
          onClose={() => setInviteConvoyId(null)}
          onInvited={fetchConvoys}
        />
      )}
    </div>
  );
}
