'use client';

import { useState } from 'react';

interface Props {
  targetType: 'post' | 'profile' | 'report' | 'spot';
  targetId: string;
}

const REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'abuse', label: 'Obraźliwe / nękanie' },
  { value: 'inappropriate', label: 'Nieodpowiednie treści' },
  { value: 'misinformation', label: 'Dezinformacja' },
  { value: 'other', label: 'Inne' },
];

export default function ReportAbuseButton({ targetType, targetId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  async function submit() {
    setStatus('loading');
    try {
      const res = await fetch('/api/abuse-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason }),
      });
      setStatus(res.ok || res.status === 409 ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <span className="text-xs text-green-400">Zgłoszono</span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-muted hover:text-red-400 transition"
        title="Zgłoś nadużycie"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
        Zgłoś
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-card-border bg-card-bg p-3 shadow-lg">
      <p className="text-xs font-semibold text-foreground">Powód zgłoszenia:</p>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="rounded-lg border border-input-border bg-input-bg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {REASONS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      {status === 'error' && <p className="text-[11px] text-red-400">Błąd zgłoszenia. Spróbuj ponownie.</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={status === 'loading'}
          className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {status === 'loading' ? '…' : 'Wyślij'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-card-border px-3 py-1.5 text-xs text-muted transition hover:text-foreground"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}
