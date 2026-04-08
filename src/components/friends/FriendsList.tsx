'use client';

import { useState, useEffect, useCallback } from 'react';

interface Friend {
  friendshipId: string;
  id: string;
  name: string;
  email: string;
  image?: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastLocation?: string;
}

export default function FriendsList() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    try {
      const res = await fetch('/api/friends');
      if (!res.ok) throw new Error('Failed to load friends');
      const data = await res.json();
      setFriends(data.friends ?? data);
    } catch {
      setError('Could not load friends.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  async function removeFriend(friendshipId: string) {
    setRemovingId(friendshipId);
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
    } catch {
      setError('Failed to remove friend.');
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg
          className="h-6 w-6 animate-spin text-blue-500"
          viewBox="0 0 24 24"
          fill="none"
        >
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

  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-zinc-500">
        <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
        <p className="text-sm">No friends yet. Add someone to get started!</p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {friends.map((friend) => (
        <li
          key={friend.friendshipId}
          className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 transition hover:border-zinc-700"
        >
          {/* Avatar */}
          <div className="relative">
            {(friend.avatarUrl || friend.image) ? (
              <img
                src={friend.avatarUrl || friend.image}
                alt={friend.name}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700 text-sm font-medium text-white">
                {friend.name.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Online indicator */}
            <span
              className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-zinc-900 ${
                friend.isOnline ? 'bg-green-500' : 'bg-zinc-600'
              }`}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {friend.name}
            </p>
            <p className="truncate text-xs text-zinc-400">
              {friend.isOnline
                ? friend.lastLocation ?? 'Online'
                : 'Offline'}
            </p>
          </div>

          {/* Remove button */}
          <button
            onClick={() => removeFriend(friend.friendshipId)}
            disabled={removingId === friend.friendshipId}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-800 hover:text-red-400 disabled:opacity-50"
            title="Remove friend"
          >
            {removingId === friend.friendshipId ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
