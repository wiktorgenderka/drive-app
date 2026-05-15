'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

type TextMessage = {
  id: string;
  type: 'text';
  userId: string;
  name: string;
  message: string;
  timestamp: string;
  edited?: boolean;
  deleted?: boolean;
};

type VoiceMessage = {
  id: string;
  type: 'voice';
  userId: string;
  name: string;
  audioData: string;
  mimeType: string;
  duration: number;
  timestamp: string;
  deleted?: boolean;
};

type Message = TextMessage | VoiceMessage;

interface ConvoyInfo {
  id: string;
  name: string;
  destName?: string | null;
  members: { userId: string; user: { name: string } }[];
}

interface Props {
  convoy: ConvoyInfo;
  onClose: () => void;
}

function genId() {
  return `${Date.now()}-${Math.random()}`;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const BAR_HEIGHTS = [3, 6, 4, 8, 5, 9, 6, 4, 7, 5, 8, 4, 6, 3, 7];

function Waveform({ playing, color }: { playing: boolean; color: string }) {
  return (
    <div className="flex items-center gap-[2px]" style={{ height: 24 }}>
      <style>{`
        @keyframes voiceBar {
          from { transform: scaleY(0.35); }
          to   { transform: scaleY(1); }
        }
      `}</style>
      {BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: 2.5,
            backgroundColor: color,
            height: playing ? h * 2.5 : 4,
            transformOrigin: 'center',
            animationName: playing ? 'voiceBar' : 'none',
            animationDuration: '0.7s',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDirection: 'alternate',
            animationDelay: `${i * 0.05}s`,
            transition: 'height 0.2s ease',
          }}
        />
      ))}
    </div>
  );
}

export default function ConvoyDriveMode({ convoy, onClose }: Props) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micError, setMicError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const chRef = useRef<RealtimeChannel | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isStartingRef = useRef(false);
  const shouldStopRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSecondsRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const loadMessages = useCallback(async () => {
    const r = await fetch(`/api/convoy/${convoy.id}/messages`, { cache: 'no-store' }).catch(() => null);
    if (!r?.ok) return;
    const data: Array<{
      id: string; userId: string; userName: string; type: string;
      message?: string | null; audioData?: string | null; mimeType?: string | null;
      duration?: number | null; edited: boolean; deleted: boolean; createdAt: string;
    }> = await r.json().catch(() => []);
    if (!Array.isArray(data)) return;
    setMessages(data.map((m) => {
      if (m.type === 'voice') {
        return { id: m.id, type: 'voice' as const, userId: m.userId, name: m.userName, audioData: m.audioData ?? '', mimeType: m.mimeType ?? '', duration: m.duration ?? 0, deleted: m.deleted, timestamp: m.createdAt };
      }
      return { id: m.id, type: 'text' as const, userId: m.userId, name: m.userName, message: m.message ?? '', edited: m.edited, deleted: m.deleted, timestamp: m.createdAt };
    }));
  }, [convoy.id]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const ch = supabase.channel(`drive:${convoy.id}`);
    chRef.current = ch;

    ch.on('broadcast', { event: 'convoy-chat' }, ({ payload }: { payload: TextMessage }) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === payload.id)) return prev;
        return [...prev, { ...payload, type: 'text' }];
      });
    })
    .on('broadcast', { event: 'convoy-voice' }, () => {
      // Audio data is in DB — reload messages to get the new voice message
      loadMessages();
    })
    .on('broadcast', { event: 'convoy-message-delete' }, ({ payload }: { payload: { messageId: string } }) => {
      setMessages((prev) => prev.map((m) => m.id === payload.messageId ? { ...m, deleted: true } : m));
    })
    .on('broadcast', { event: 'convoy-message-edit' }, ({ payload }: { payload: { messageId: string; newText: string } }) => {
      setMessages((prev) => prev.map((m) =>
        m.id === payload.messageId && m.type === 'text' ? { ...m, message: payload.newText, edited: true } : m
      ));
    })
    .subscribe();

    return () => {
      ch.unsubscribe();
      chRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convoy.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const handler = () => setSelectedId(null);
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [selectedId]);

  const sendText = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !chRef.current) return;
    const id = genId();
    const msg: TextMessage = {
      id,
      type: 'text',
      userId: session?.user?.id ?? '',
      name: session?.user?.name ?? 'Nieznany',
      message: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
    setInput('');
    fetch(`/api/convoy/${convoy.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'text', message: trimmed }),
    }).catch((err) => console.error('[ConvoyDriveMode] POST text:', err));
    chRef.current.send({ type: 'broadcast', event: 'convoy-chat', payload: msg });
  }, [input, convoy.id, session]);

  const deleteMessage = useCallback((id: string) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, deleted: true } : m));
    fetch(`/api/convoy/${convoy.id}/messages`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: id, action: 'delete' }),
    }).catch(() => {});
    chRef.current?.send({ type: 'broadcast', event: 'convoy-message-delete', payload: { messageId: id } });
    setSelectedId(null);
  }, [convoy.id]);

  const startEdit = useCallback((msg: TextMessage) => {
    setEditingId(msg.id);
    setEditText(msg.message);
    setSelectedId(null);
  }, []);

  const confirmEdit = useCallback((id: string) => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    setMessages((prev) => prev.map((m) => m.id === id && m.type === 'text' ? { ...m, message: trimmed, edited: true } : m));
    fetch(`/api/convoy/${convoy.id}/messages`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: id, action: 'edit', newText: trimmed }),
    }).catch(() => {});
    chRef.current?.send({ type: 'broadcast', event: 'convoy-message-edit', payload: { messageId: id, newText: trimmed } });
    setEditingId(null);
    setEditText('');
  }, [editText, convoy.id]);

  const startRecording = useCallback(async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;
    shouldStopRef.current = false;
    setMicError('');
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicError('Twoja przeglądarka nie obsługuje mikrofonu.');
        isStartingRef.current = false;
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (shouldStopRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        isStartingRef.current = false;
        return;
      }

      const mimeType =
        ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4']
          .find((t) => MediaRecorder.isTypeSupported(t)) ?? '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      const actualMimeType = recorder.mimeType;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        isStartingRef.current = false;
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        const duration = recordingSecondsRef.current;
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: actualMimeType });
        if (blob.size === 0) return;

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          if (!base64) return;
          const id = genId();
          const voiceMsg: VoiceMessage = {
            id,
            type: 'voice',
            userId: session?.user?.id ?? '',
            name: session?.user?.name ?? 'Nieznany',
            audioData: base64,
            mimeType: actualMimeType,
            duration,
            timestamp: new Date().toISOString(),
          };
          // Optimistic: sender sees immediately
          setMessages((prev) => {
            if (prev.some((m) => m.id === id)) return prev;
            return [...prev, voiceMsg];
          });
          // Persist to DB
          fetch(`/api/convoy/${convoy.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, type: 'voice', audioData: base64, mimeType: actualMimeType, duration }),
          }).catch(() => {});
          // Notify others (no audio data — they reload from DB)
          chRef.current?.send({ type: 'broadcast', event: 'convoy-voice', payload: { id, userId: voiceMsg.userId, name: voiceMsg.name, duration, timestamp: voiceMsg.timestamp } });
        };
        reader.readAsDataURL(blob);
      };

      recorder.start(100);
      setRecording(true);

      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds((s) => s + 1);
      }, 1000);

      if (shouldStopRef.current) {
        recorder.stop();
        setRecording(false);
      }
    } catch (err: unknown) {
      isStartingRef.current = false;
      setRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setMicError('Brak dostępu do mikrofonu. Zezwól w ustawieniach przeglądarki.');
      } else if (name === 'NotFoundError') {
        setMicError('Nie znaleziono mikrofonu w urządzeniu.');
      } else {
        setMicError(`Błąd mikrofonu: ${name ?? 'nieznany'}`);
      }
    }
  }, [convoy.id, session]);

  const stopRecording = useCallback(() => {
    shouldStopRef.current = true;
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecording(false);
    setRecordingSeconds(0);
  }, []);

  const playVoice = useCallback((msg: VoiceMessage) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === msg.id) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(`data:${msg.mimeType};base64,${msg.audioData}`);
    audioRef.current = audio;
    setPlayingId(msg.id);
    setPlayProgress((p) => ({ ...p, [msg.id]: 0 }));
    audio.ontimeupdate = () => {
      if (audio.duration) {
        setPlayProgress((p) => ({ ...p, [msg.id]: audio.currentTime / audio.duration }));
      }
    };
    audio.onended = () => {
      setPlayingId(null);
      setPlayProgress((p) => ({ ...p, [msg.id]: 0 }));
      audioRef.current = null;
    };
    audio.play().catch(() => setPlayingId(null));
  }, [playingId]);

  const currentUserId = session?.user?.id;

  const content = (
    <div className="fixed inset-0 z-[999] flex flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-card-border bg-card-bg px-4 pb-3 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="1" y="3" width="15" height="13" rx="2" />
            <path d="M16 8h4l3 3v5a1 1 0 01-1 1h-2" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-foreground">{convoy.name}</p>
          <p className="text-xs text-muted">
            {convoy.members.length} {convoy.members.length === 1 ? 'osoba' : 'osoby'}
            {convoy.destName && <> · <span className="text-blue-400">{convoy.destName}</span></>}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-card-border bg-card-bg text-muted transition hover:text-foreground"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-400">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-sm text-muted">Brak wiadomości. Zacznij rozmowę!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.userId === currentUserId;
          const isSelected = selectedId === msg.id;
          const isEditing = editingId === msg.id;

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {isSelected && isMe && !msg.deleted && (
                <div
                  className={`mb-1 flex gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {msg.type === 'text' && (
                    <button
                      onClick={() => startEdit(msg as TextMessage)}
                      className="flex items-center gap-1 rounded-lg border border-card-border bg-card-bg px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-input-bg"
                    >
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Edytuj
                    </button>
                  )}
                  <button
                    onClick={() => deleteMessage(msg.id)}
                    className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                    Usuń
                  </button>
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  isMe
                    ? 'rounded-br-sm bg-accent text-accent-fg'
                    : 'rounded-bl-sm border border-card-border bg-card-bg text-foreground'
                } ${isMe && !msg.deleted ? 'cursor-pointer active:opacity-80' : ''}`}
                onPointerDown={(e) => {
                  if (!isMe || msg.deleted) return;
                  e.stopPropagation();
                  setSelectedId(isSelected ? null : msg.id);
                  setEditingId(null);
                }}
              >
                {!isMe && (
                  <p className="mb-1 text-xs font-semibold text-emerald-400">{msg.name}</p>
                )}

                {msg.deleted ? (
                  <p className={`text-sm italic ${isMe ? 'text-emerald-200' : 'text-muted'}`}>
                    Wiadomość usunięta
                  </p>
                ) : isEditing && msg.type === 'text' ? (
                  <div className="flex flex-col gap-2" onPointerDown={(e) => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmEdit(msg.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      maxLength={500}
                      className="rounded-lg bg-white/10 px-2 py-1 text-sm text-white outline-none placeholder:text-emerald-200 focus:ring-1 focus:ring-white/40"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => confirmEdit(msg.id)} className="rounded-lg bg-white/20 px-2 py-1 text-xs font-semibold text-white hover:bg-white/30">Zapisz</button>
                      <button onClick={() => setEditingId(null)} className="rounded-lg px-2 py-1 text-xs text-emerald-200 hover:text-white">Anuluj</button>
                    </div>
                  </div>
                ) : msg.type === 'text' ? (
                  <p className="text-base leading-snug">{msg.message}</p>
                ) : msg.type === 'voice' ? (() => {
                  const isPlaying = playingId === msg.id;
                  const progress = playProgress[msg.id] ?? 0;
                  const barColor = isMe ? 'rgba(255,255,255,0.9)' : '#10b981';
                  return (
                    <button
                      onClick={() => playVoice(msg as VoiceMessage)}
                      className="flex w-full flex-col gap-2"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${isMe ? 'bg-white/20 hover:bg-white/30' : 'bg-emerald-600/20 hover:bg-emerald-600/30'}`}>
                          {isPlaying ? (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                          ) : (
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                          )}
                        </div>
                        <Waveform playing={isPlaying} color={barColor} />
                        <span className={`ml-auto text-xs tabular-nums ${isMe ? 'text-emerald-200' : 'text-muted'}`}>
                          {formatTime((msg as VoiceMessage).duration ?? 0)}
                        </span>
                      </div>
                      <div className={`h-0.5 w-full rounded-full ${isMe ? 'bg-white/20' : 'bg-card-border'}`}>
                        <div className={`h-full rounded-full transition-all ${isMe ? 'bg-white/70' : 'bg-emerald-500'}`} style={{ width: `${progress * 100}%` }} />
                      </div>
                    </button>
                  );
                })() : null}

                <div className={`mt-1 flex items-center gap-1 text-xs ${isMe ? 'text-emerald-200 justify-end' : 'text-muted'}`}>
                  {msg.type === 'text' && !msg.deleted && (msg as TextMessage).edited && (
                    <span className="italic">edytowano ·</span>
                  )}
                  {new Date(msg.timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-card-border bg-card-bg px-4 pb-8 pt-4">
        {micError && (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {micError}
          </div>
        )}
        {showInput ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInput(false)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-card-border text-muted transition hover:text-foreground"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') sendText(); }}
              placeholder="Wpisz wiadomość..."
              maxLength={500}
              autoFocus
              className="flex-1 rounded-2xl border border-card-border bg-input-bg px-4 py-3 text-base text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              onClick={sendText}
              disabled={!input.trim()}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-fg transition hover:bg-emerald-700 disabled:opacity-40"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowInput(true)}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-card-border bg-input-bg text-muted transition hover:text-foreground"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </button>

            <button
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              onPointerLeave={stopRecording}
              className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl py-4 transition select-none ${
                recording
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/40'
                  : 'bg-accent text-accent-fg hover:opacity-90'
              }`}
            >
              {recording && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold tabular-nums text-white/80">
                  {formatTime(recordingSeconds)}
                </span>
              )}
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span className="text-sm font-semibold">
                {recording ? 'Nagrywanie...' : 'Przytrzymaj i mów'}
              </span>
              {recording && (
                <span className="flex gap-1">
                  {[0, 0.15, 0.3].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 rounded-full bg-white/80"
                      style={{ animationName: 'pulse', animationDuration: '1s', animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite', animationDelay: `${d}s` }}
                    />
                  ))}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
