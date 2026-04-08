'use client';

import { useState, useEffect, useCallback } from 'react';

interface NowPlaying {
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  trackUrl: string;
  progressMs: number;
  durationMs: number;
}

export default function SpotifyWidget() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [connecting, setConnecting] = useState(false);

  const fetchNowPlaying = useCallback(async () => {
    try {
      const res = await fetch('/api/spotify');
      if (!res.ok) return;
      const data = await res.json();
      setConnected(data.connected);
      setNowPlaying(data.nowPlaying ?? null);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchNowPlaying();
    const interval = setInterval(fetchNowPlaying, 10000);
    return () => clearInterval(interval);
  }, [fetchNowPlaying]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch('/api/spotify', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.url;
      }
    } catch {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch('/api/spotify', { method: 'DELETE' });
      if (res.ok) {
        setConnected(false);
        setNowPlaying(null);
      }
    } catch {
      // silent
    }
  };

  // Loading
  if (connected === null) return null;

  // Not connected — show connect button
  if (!connected) {
    return (
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-[#1DB954]/30 bg-[#1DB954]/10 px-4 py-3 text-left transition hover:bg-[#1DB954]/15 disabled:opacity-50"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1DB954] text-white">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            {connecting ? 'Łączenie...' : 'Połącz ze Spotify'}
          </p>
          <p className="text-xs text-muted">Pokaż co słuchasz znajomym</p>
        </div>
        <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    );
  }

  // Connected but nothing playing
  if (!nowPlaying) {
    return (
      <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-[#1DB954]/20 bg-[#1DB954]/5 px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1DB954]/20 text-[#1DB954]">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted">Spotify połączone</p>
          <p className="text-xs text-muted/60">Nic nie jest odtwarzane</p>
        </div>
        <button
          onClick={handleDisconnect}
          className="text-xs text-muted hover:text-red-400 transition"
        >
          Odłącz
        </button>
      </div>
    );
  }

  // Now playing
  const progress = nowPlaying.durationMs > 0
    ? (nowPlaying.progressMs / nowPlaying.durationMs) * 100
    : 0;

  return (
    <div className="mx-5 mt-4 overflow-hidden rounded-2xl border border-[#1DB954]/30 bg-gradient-to-r from-[#1DB954]/10 to-[#191414]/30">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Album art */}
        {nowPlaying.albumArt ? (
          <img
            src={nowPlaying.albumArt}
            alt={nowPlaying.album}
            className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-md"
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#1DB954]/20 text-[#1DB954]">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {nowPlaying.isPlaying && (
              <div className="flex items-end gap-[2px] h-3">
                <span className="w-[3px] bg-[#1DB954] rounded-full animate-[eq-bar1_0.5s_ease-in-out_infinite_alternate]" style={{height: '40%'}} />
                <span className="w-[3px] bg-[#1DB954] rounded-full animate-[eq-bar2_0.7s_ease-in-out_infinite_alternate]" style={{height: '70%'}} />
                <span className="w-[3px] bg-[#1DB954] rounded-full animate-[eq-bar3_0.6s_ease-in-out_infinite_alternate]" style={{height: '50%'}} />
              </div>
            )}
            <p className="text-sm font-semibold text-foreground truncate">
              {nowPlaying.title}
            </p>
          </div>
          <p className="text-xs text-muted truncate">{nowPlaying.artist}</p>
        </div>
        {/* Spotify logo */}
        <svg className="h-5 w-5 shrink-0 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>
      </div>
      {/* Progress bar */}
      <div className="h-[2px] w-full bg-white/5">
        <div
          className="h-full bg-[#1DB954] transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
