'use client';

import { useState, useEffect, useCallback } from 'react';

interface FriendRequest {
  id: string;
  fromUser: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
  createdAt: string;
}

export default function FriendRequests() {
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/friends/requests');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : (data.requests ?? []));
    } catch {
      setError('Could not load friend requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function handleAction(requestId: string, action: 'accept' | 'reject') {
    setProcessingId(requestId);
    try {
      const res = await fetch(`/api/friends/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      setError(`Failed to ${action} request.`);
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="h-6 w-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        No pending friend requests.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {requests.map((req) => (
        <li
          key={req.id}
          className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
        >
          {/* Avatar */}
          {req.fromUser.avatarUrl ? (
            <img
              src={req.fromUser.avatarUrl}
              alt={req.fromUser.name}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700 text-sm font-medium text-white">
              {req.fromUser.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {req.fromUser.name}
            </p>
            <p className="truncate text-xs text-zinc-400">
              {req.fromUser.email}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => handleAction(req.id, 'accept')}
              disabled={processingId === req.id}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              {processingId === req.id ? '...' : 'Accept'}
            </button>
            <button
              onClick={() => handleAction(req.id, 'reject')}
              disabled={processingId === req.id}
              className="rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-600 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
