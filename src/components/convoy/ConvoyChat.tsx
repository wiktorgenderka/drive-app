'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { getSupabaseClient } from '@/lib/supabase-client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ChatMessage {
  userId: string;
  name: string;
  message: string;
  timestamp: string;
}

interface ConvoyChatProps {
  convoyId: string;
}

export default function ConvoyChat({ convoyId }: ConvoyChatProps) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const chRef = useRef<RealtimeChannel | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const ch = supabase.channel(`convoy:${convoyId}`);
    chRef.current = ch;

    ch.on('broadcast', { event: 'convoy-chat' }, ({ payload }: { payload: ChatMessage }) => {
      setMessages((prev) => {
        if (prev.some((m) => m.timestamp === payload.timestamp && m.userId === payload.userId)) return prev;
        return [...prev, payload];
      });
    })
    .subscribe();

    return () => {
      ch.unsubscribe();
      chRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convoyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !chRef.current) return;

    const msg: ChatMessage = {
      userId: session?.user?.id ?? '',
      name: session?.user?.name ?? 'Nieznany',
      message: trimmed,
      timestamp: new Date().toISOString(),
    };

    chRef.current.send({ type: 'broadcast', event: 'convoy-chat', payload: msg });
    setMessages((prev) => [...prev, msg]);
    setInput('');
  }, [input, session]);

  const currentUserId = session?.user?.id;

  return (
    <div className="flex flex-col" style={{ height: 300 }}>
      <div className="flex-1 overflow-y-auto space-y-2 p-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-muted pt-8">Brak wiadomoĹ›ci. Rozpocznij czat!</p>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.userId === currentUserId;
          return (
            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                isMe
                  ? 'rounded-br-sm bg-accent text-accent-fg'
                  : 'rounded-bl-sm border border-card-border bg-card-bg text-foreground'
              }`}>
                {!isMe && (
                  <p className="text-[10px] font-semibold text-emerald-400 mb-0.5">{msg.name}</p>
                )}
                <p className="text-sm">{msg.message}</p>
                <p className={`text-[10px] mt-0.5 ${isMe ? 'text-emerald-200' : 'text-muted'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-card-border flex items-center gap-2 p-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
          placeholder="Wpisz wiadomoĹ›Ä‡..."
          maxLength={500}
          className="flex-1 rounded-xl border border-card-border bg-input-bg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-fg transition hover:opacity-90 disabled:opacity-40"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
