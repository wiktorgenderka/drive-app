'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ConvoyBasic {
  id: string;
  name: string;
}

interface IncomingMsg {
  name: string;
  type: 'text' | 'voice';
}

interface Props {
  onIncomingMessage?: (msg: IncomingMsg) => void;
}

function genId() {
  return `${Date.now()}-${Math.random()}`;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ConvoyMapVoice({ onIncomingMessage }: Props) {
  const { data: session } = useSession();
  const [convoy, setConvoy] = useState<ConvoyBasic | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [feedback, setFeedback] = useState<'sent' | 'error' | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const chRef = useRef<RealtimeChannel | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isStartingRef = useRef(false);
  const shouldStopRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSecondsRef = useRef(0);
  const onIncomingRef = useRef(onIncomingMessage);
  onIncomingRef.current = onIncomingMessage;

  useEffect(() => {
    fetch('/api/convoy')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.convoys ?? []);
        if (list.length > 0) setConvoy({ id: list[0].id, name: list[0].name });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!convoy?.id || !session?.user?.id) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const ch = supabase.channel(`mapvoice:${convoy.id}`);
    chRef.current = ch;

    ch.on('broadcast', { event: 'convoy-chat' }, ({ payload }: { payload: { userId: string; name: string } }) => {
      if (payload.userId !== session.user.id) {
        onIncomingRef.current?.({ name: payload.name, type: 'text' });
      }
    })
    .on('broadcast', { event: 'convoy-voice' }, ({ payload }: { payload: { userId: string; name: string } }) => {
      if (payload.userId !== session.user.id) {
        onIncomingRef.current?.({ name: payload.name, type: 'voice' });
      }
    })
    .subscribe();

    return () => {
      ch.unsubscribe();
      chRef.current = null;
    };
  }, [convoy?.id, session?.user?.id]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const showFeedback = useCallback((type: 'sent' | 'error', msg: string) => {
    setFeedback(type);
    setFeedbackMsg(msg);
    setTimeout(() => setFeedback(null), 2500);
  }, []);

  const startRecording = useCallback(async () => {
    if (!convoy || isStartingRef.current) return;
    isStartingRef.current = true;
    shouldStopRef.current = false;
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        showFeedback('error', 'Brak obsługi mikrofonu');
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
          const userId = session?.user?.id ?? '';
          const name = session?.user?.name ?? 'Nieznany';

          // Persist to DB
          fetch(`/api/convoy/${convoy.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, type: 'voice', audioData: base64, mimeType: actualMimeType, duration }),
          }).catch(() => {});

          // Notify others (metadata only — they reload from DB)
          chRef.current?.send({
            type: 'broadcast',
            event: 'convoy-voice',
            payload: { id, userId, name, duration, timestamp: new Date().toISOString() },
          });
          showFeedback('sent', 'Wysłano!');
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
      showFeedback(
        'error',
        name === 'NotAllowedError' ? 'Brak dostępu do mikrofonu' : 'Błąd mikrofonu'
      );
    }
  }, [convoy, session, showFeedback]);

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

  if (!convoy) return null;

  return (
    <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 flex flex-col items-center gap-2">
      {feedback && (
        <div
          className={`rounded-xl px-3 py-1.5 text-xs font-medium backdrop-blur-md shadow-lg ${
            feedback === 'sent'
              ? 'bg-emerald-900/90 text-emerald-300'
              : 'bg-red-900/90 text-red-300'
          }`}
        >
          {feedbackMsg}
        </div>
      )}

      <button
        onPointerDown={startRecording}
        onPointerUp={stopRecording}
        onPointerLeave={stopRecording}
        className={`flex items-center gap-3 rounded-2xl px-5 py-2.5 shadow-lg backdrop-blur-md transition select-none ${
          recording
            ? 'bg-red-600 text-white shadow-red-600/40'
            : 'bg-card-bg/95 border border-card-border text-foreground hover:bg-card-bg shadow-black/20'
        }`}
      >
        <svg
          className={`h-4 w-4 shrink-0 ${recording ? 'text-white' : 'text-emerald-500'}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        >
          <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
        <span className="text-sm font-semibold tabular-nums">
          {recording ? formatTime(recordingSeconds) : convoy.name}
        </span>
        {!recording && (
          <span className="text-xs text-muted">· przytrzymaj i mów</span>
        )}
        {recording && (
          <span className="flex gap-1">
            {[0, 0.2, 0.4].map((d) => (
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
  );
}
