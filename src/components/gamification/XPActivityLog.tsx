'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface XPEvent {
  id: string;
  type: string;
  label: string;
  emoji: string;
  amount: number;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'teraz';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min temu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h temu`;
  const d = Math.floor(h / 24);
  return `${d}d temu`;
}

export default function XPActivityLog() {
  const [events, setEvents] = useState<XPEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/xp/events?limit=30')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setEvents(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="text-4xl">⚡</span>
        <p className="text-sm font-semibold text-foreground">Brak historii XP</p>
        <p className="text-xs text-muted">Zacznij jeździć aby zbierać punkty</p>
      </div>
    );
  }

  const totalEarned = events.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl bg-input-bg px-4 py-2.5">
        <span className="text-xs text-muted">Ostatnie {events.length} zdarzeń</span>
        <div className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <span className="text-sm font-bold text-accent tabular-nums">+{totalEarned.toLocaleString('pl-PL')} XP</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {events.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.025 }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-input-bg"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-input-bg text-lg">
              {event.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{event.label}</p>
              <p className="text-xs text-muted">{timeAgo(event.createdAt)}</p>
            </div>
            <div className="flex items-center gap-1 text-accent">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span className="text-sm font-bold tabular-nums">+{event.amount}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
