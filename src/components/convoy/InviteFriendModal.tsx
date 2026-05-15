'use client';

import { useState, useEffect, useCallback } from 'react';

interface Friend {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface InviteFriendModalProps {
  open: boolean;
  convoyId: string;
  existingMemberIds: string[];
  onClose: () => void;
  onInvited: () => void;
}

export default function InviteFriendModal({
  open,
  convoyId,
  existingMemberIds,
  onClose,
  onInvited,
}: InviteFriendModalProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const fetchFriends = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/friends/online');
      if (!res.ok) throw new Error();
      const data: Friend[] = await res.json();
      setFriends(data);
    } catch {
      setError('Nie udało się załadować znajomych.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchFriends();
      setInvited(new Set());
      setError('');
    }
  }, [open, fetchFriends]);

  const handleInvite = async (userId: string) => {
    setInvitingId(userId);
    setError('');
    try {
      const res = await fetch(`/api/convoy/${convoyId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error === 'User is already a member' ? 'Już jest członkiem' : 'Nie udało się zaprosić.');
        return;
      }
      setInvited((prev) => new Set(prev).add(userId));
      onInvited();
    } catch {
      setError('Wystąpił błąd.');
    } finally {
      setInvitingId(null);
    }
  };

  if (!open) return null;

  const availableFriends = friends.filter(
    (f) => !existingMemberIds.includes(f.id) && !invited.has(f.id)
  );
  const alreadyInvited = friends.filter((f) => invited.has(f.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-card-bg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-lg font-semibold text-foreground">Zaproś znajomego</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-input-bg hover:text-foreground"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="max-h-80 overflow-y-auto px-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <svg className="h-6 w-6 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : availableFriends.length === 0 && alreadyInvited.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <svg className="h-8 w-8 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
              <p className="text-sm text-muted">Wszyscy znajomi są już w konwoju</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {/* Already invited this session */}
              {alreadyInvited.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-emerald-500/5"
                >
                  {friend.image ? (
                    <img src={friend.image} alt={friend.name} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600/20 text-xs font-semibold text-emerald-400">
                      {friend.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{friend.name}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Zaproszono
                  </span>
                </div>
              ))}

              {/* Available to invite */}
              {availableFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-input-bg/50"
                >
                  {friend.image ? (
                    <img src={friend.image} alt={friend.name} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card-bg border border-card-border text-xs font-semibold text-muted">
                      {friend.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{friend.name}</p>
                    <p className="text-xs text-muted truncate">{friend.email}</p>
                  </div>
                  <button
                    onClick={() => handleInvite(friend.id)}
                    disabled={invitingId === friend.id}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {invitingId === friend.id ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      'Zaproś'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
