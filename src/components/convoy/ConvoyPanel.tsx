'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getSupabaseClient } from '@/lib/supabase-client';
import CreateConvoyModal from './CreateConvoyModal';
import InviteFriendModal from './InviteFriendModal';
import ConvoyChat from './ConvoyChat';
import ConvoyDriveMode from './ConvoyDriveMode';

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

  const fetchConvoys = useCallback(async () => {
    try {
      const res = await fetch('/api/convoy');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConvoys(Array.isArray(data) ? data : data.convoys ?? []);
    } catch {
      setError('Nie udało się załadować konwojów.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConvoys();
  }, [fetchConvoys]);

  const leaveOrDelete = async (convoy: Convoy) => {
    const isOwner = convoy.ownerId === session?.user?.id;
    const action = isOwner ? 'usunąć' : 'opuścić';
    if (!confirm(`Czy na pewno chcesz ${action} konwój "${convoy.name}"?`)) return;

    setActionLoading(convoy.id);
    try {
      const res = await fetch(`/api/convoy?convoyId=${convoy.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      await fetchConvoys();
    } catch {
      setError('Operacja nie powiodła się.');
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
      setError('Nie udało się ustawić celu.');
    } finally {
      setActionLoading(null);
    }
  };

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
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Utwórz
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
                <span className="text-sm font-medium text-foreground">Przycisk głosowy na mapie</span>
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
                <span className="text-xs text-muted">Pokazuj wiadomości konwoju podczas jazdy</span>
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
          <button onClick={() => setError('')} className="ml-2 text-red-300 hover:text-red-200">✕</button>
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
            <p className="text-sm font-medium text-foreground">Brak konwojów</p>
            <p className="mt-0.5 text-xs text-muted">Utwórz konwój i zaproś znajomych!</p>
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
                        {memberCount} {memberCount === 1 ? 'członek' : memberCount < 5 ? 'członków' : 'członków'}
                        {isOwner && <span className="ml-1.5 text-emerald-500">· Lider</span>}
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
                    {/* Member list */}
                    {convoy.members.length === 0 ? (
                      <p className="py-2 text-center text-xs text-muted">Brak członków.</p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {convoy.members.map((member) => (
                          <li key={member.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-input-bg/50">
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
                            <span className="flex-1 truncate text-sm text-foreground">
                              {member.user.name}
                            </span>
                            {member.role === 'OWNER' && (
                              <span className="rounded-md bg-emerald-600/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                Lider
                              </span>
                            )}
                            {member.userId === currentUserId && member.role !== 'OWNER' && (
                              <span className="rounded-md bg-blue-600/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                                Ty
                              </span>
                            )}
                          </li>
                        ))}
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
                            Zmień
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
                          placeholder="Cel podróży (np. Warszawa)"
                          className="flex-1 rounded-xl border border-card-border bg-input-bg px-3 py-2 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={() => setDestination(convoy.id, destInput)}
                          disabled={actionLoading === `dest-${convoy.id}`}
                          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => setDestConvoyId(null)}
                          className="rounded-xl border border-card-border px-3 py-2 text-xs text-muted transition hover:bg-input-bg"
                        >
                          ✕
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
                        Zaproś
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
                      <button
                        onClick={() => setDriveModeConvoy(convoy)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
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
                        Jedź
                      </button>
                      <button
                        onClick={() => leaveOrDelete(convoy)}
                        disabled={actionLoading === convoy.id}
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {actionLoading === convoy.id ? '...' : isOwner ? 'Usuń' : 'Opuść'}
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
