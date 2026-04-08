'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import CreateConvoyModal from './CreateConvoyModal';
import InviteFriendModal from './InviteFriendModal';

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
  members: ConvoyMember[];
}

export default function ConvoyPanel() {
  const { data: session } = useSession();
  const [convoys, setConvoys] = useState<Convoy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [inviteConvoyId, setInviteConvoyId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  const currentUserId = session?.user?.id;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Twoje konwoje</h2>
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

                    {/* Actions */}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setInviteConvoyId(convoy.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                          <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                          <circle cx="8.5" cy="7" r="4" />
                          <path d="M20 8v6M23 11h-6" />
                        </svg>
                        Zaproś
                      </button>
                      <button
                        onClick={() => leaveOrDelete(convoy)}
                        disabled={actionLoading === convoy.id}
                        className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {actionLoading === convoy.id
                          ? 'Ładowanie...'
                          : isOwner
                            ? 'Usuń konwój'
                            : 'Opuść konwój'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
