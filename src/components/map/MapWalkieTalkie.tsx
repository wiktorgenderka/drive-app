'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export default function MapWalkieTalkie() {
  const { data: session } = useSession();
  const [recording, setRecording] = useState(false);
  const [speakerName, setSpeakerName] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const chRef = useRef<RealtimeChannel | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isStartingRef = useRef(false);
  const shouldStopRef = useRef(false);
  const speakerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    const supabase = getSupabaseClient();
    if (!supabase || !userId) return;

    const ch = supabase.channel('walkie-global');
    chRef.current = ch;

    ch.on(
      'broadcast',
      { event: 'walkie-audio' },
      ({ payload }: { payload: { userId: string; name: string; audio: string; mimeType: string } }) => {
        if (payload.userId === userId) return;

        if (speakerTimerRef.current) clearTimeout(speakerTimerRef.current);
        setSpeakerName(payload.name);
        speakerTimerRef.current = setTimeout(() => setSpeakerName(null), 4000);

        try {
          const binary = atob(payload.audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: payload.mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.play().catch(() => {});
          audio.onended = () => URL.revokeObjectURL(url);
        } catch { /* ignore */ }
      }
    )
    .subscribe();

    return () => {
      ch.unsubscribe();
      chRef.current = null;
      if (speakerTimerRef.current) clearTimeout(speakerTimerRef.current);
    };
  }, [session?.user?.id]);

  const startRecording = useCallback(async () => {
    if (isStartingRef.current || !session?.user?.id) return;
    isStartingRef.current = true;
    shouldStopRef.current = false;
    setErr(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErr('Brak obsługi mikrofonu');
        setTimeout(() => setErr(null), 3000);
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
        ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
          .find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      const actualMime = recorder.mimeType;
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        isStartingRef.current = false;
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: actualMime });
        if (blob.size === 0 || !chRef.current) return;

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          if (!base64) return;
          chRef.current?.send({
            type: 'broadcast',
            event: 'walkie-audio',
            payload: {
              userId: session?.user?.id ?? '',
              name: session?.user?.name ?? 'Nieznany',
              audio: base64,
              mimeType: actualMime,
            },
          });
        };
        reader.readAsDataURL(blob);
      };

      recorder.start(100);
      setRecording(true);
      if (shouldStopRef.current) { recorder.stop(); setRecording(false); }
    } catch (e: unknown) {
      isStartingRef.current = false;
      setRecording(false);
      const name = (e as { name?: string })?.name;
      setErr(name === 'NotAllowedError' ? 'Brak dostępu do mikrofonu' : 'Błąd mikrofonu');
      setTimeout(() => setErr(null), 3000);
    }
  }, [session?.user?.id, session?.user?.name]);

  const stopRecording = useCallback(() => {
    shouldStopRef.current = true;
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setRecording(false);
  }, []);

  return (
    <div className="relative">
      {(err || speakerName) && (
        <div className={`absolute right-full top-0 mr-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md ${
          err
            ? 'bg-red-900/90 text-red-300'
            : 'border border-card-border bg-card-bg/95 text-foreground'
        }`}>
          {err ?? `🎙️ ${speakerName}`}
        </div>
      )}
      <button
        onPointerDown={startRecording}
        onPointerUp={stopRecording}
        onPointerLeave={stopRecording}
        className={`flex h-10 w-10 select-none items-center justify-center rounded-xl shadow-lg transition-all ${
          recording ? 'bg-red-600 text-white' : 'text-muted hover:text-foreground'
        }`}
        style={!recording ? { backgroundColor: 'rgba(24,24,27,0.9)', border: '1px solid #3f3f46', backdropFilter: 'blur(8px)' } : {}}
        title="Walkie-talkie — przytrzymaj i mów"
      >
        {recording ? (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M19 11a7 7 0 01-14 0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M19 11a7 7 0 01-14 0" strokeLinecap="round" />
            <line x1="12" y1="18" x2="12" y2="22" strokeLinecap="round" />
            <line x1="8" y1="22" x2="16" y2="22" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
