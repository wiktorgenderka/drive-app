'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMapStore } from '@/stores/useMapStore';

interface EventAttendee { userId: string; status: 'GOING' | 'MAYBE' | 'NOT_GOING' }
interface DriveEvent {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  latitude: number;
  longitude: number;
  locationName: string | null;
  maxAttendees: number | null;
  _count: { attendees: number };
  myStatus?: 'GOING' | 'MAYBE' | 'NOT_GOING' | null;
}

type CreateForm = {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  locationName: string;
  maxAttendees: string;
};

const EMPTY_FORM: CreateForm = {
  title: '', description: '', startAt: '', endAt: '',
  locationName: '', maxAttendees: '',
};

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const timeStr = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === today.toDateString()) return `Dzisiaj, ${timeStr}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Jutro, ${timeStr}`;
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function EventPanel() {
  const [events, setEvents] = useState<DriveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attending, setAttending] = useState<string | null>(null);
  const userLocation = useMapStore((s) => s.userLocation);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const lat = userLocation?.latitude ?? 52.2297;
      const lng = userLocation?.longitude ?? 21.0122;
      const res = await fetch(`/api/events?lat=${lat}&lng=${lng}&upcoming=true`);
      if (res.ok) {
        const data: DriveEvent[] = await res.json();
        setEvents(data);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, [userLocation]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  async function attend(eventId: string, status: 'GOING' | 'MAYBE' | 'NOT_GOING') {
    setAttending(eventId);
    try {
      await fetch(`/api/events/${eventId}/attend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, myStatus: status } : e));
    } catch { /* silent */ }
    setAttending(null);
  }

  async function handleCreate(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const lat = userLocation?.latitude ?? 52.2297;
      const lng = userLocation?.longitude ?? 21.0122;
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          startAt: new Date(form.startAt).toISOString(),
          endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
          latitude: lat,
          longitude: lng,
          locationName: form.locationName || undefined,
          maxAttendees: form.maxAttendees ? parseInt(form.maxAttendees) : undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.formErrors?.[0] ?? 'Błąd tworzenia');
      }
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await fetchEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd tworzenia');
    }
    setSaving(false);
  }

  // Min datetime-local value (now)
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString().slice(0, 16);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Eventy motoryzacyjne</h3>
          <p className="text-xs text-muted">Znajdź meetupy w swoim regionie</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { setShowCreate(!showCreate); setError(null); }}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white shadow-lg transition hover:opacity-90"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Utwórz
        </motion.button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            onSubmit={handleCreate}
            className="overflow-hidden rounded-2xl border border-accent/30 bg-card-bg"
          >
            <div className="p-5">
              <h4 className="mb-4 text-sm font-bold text-foreground">Nowy event</h4>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted">Nazwa eventu *</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="np. Nocny Zlot Motoryzacyjny"
                    className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted">Opis</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Opisz event…"
                    className="w-full resize-none rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted">Data rozpoczęcia *</label>
                    <input
                      required
                      type="datetime-local"
                      min={nowLocal}
                      value={form.startAt}
                      onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                      className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted">Data zakończenia</label>
                    <input
                      type="datetime-local"
                      min={form.startAt || nowLocal}
                      value={form.endAt}
                      onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                      className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted">Miejsce</label>
                    <input
                      value={form.locationName}
                      onChange={(e) => setForm({ ...form, locationName: e.target.value })}
                      placeholder="np. Parking IKEA Janki"
                      className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted">Maks. uczestników</label>
                    <input
                      type="number"
                      min={1}
                      value={form.maxAttendees}
                      onChange={(e) => setForm({ ...form, maxAttendees: e.target.value })}
                      placeholder="bez limitu"
                      className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-muted">
                  Lokalizacja eventu zostanie ustawiona na Twoją aktualną pozycję GPS.
                </p>
              </div>

              {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

              <div className="mt-4 flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Tworzenie…' : 'Utwórz event'}
                </motion.button>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); setError(null); }}
                  className="rounded-xl border border-card-border px-4 py-2.5 text-sm text-muted transition hover:text-foreground"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Events list */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
        </div>
      ) : events.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-card-border bg-card-bg/50 py-12 text-center"
        >
          <span className="text-5xl">🏁</span>
          <div>
            <p className="text-sm font-semibold text-foreground">Brak eventów w pobliżu</p>
            <p className="mt-1 text-xs text-muted">Bądź pierwszy i stwórz event dla lokalnej sceny!</p>
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event, i) => {
            const days = daysUntil(event.startAt);
            const isGoing = event.myStatus === 'GOING';
            const isMaybe = event.myStatus === 'MAYBE';
            const isLoading = attending === event.id;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-card-border bg-card-bg overflow-hidden"
              >
                {/* Color header bar */}
                <div className={`h-1 w-full ${isGoing ? 'bg-emerald-500' : isMaybe ? 'bg-amber-500' : 'bg-accent'}`} />

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-semibold text-foreground">{event.title}</h4>
                      {event.description && (
                        <p className="mt-1 text-sm text-muted line-clamp-2">{event.description}</p>
                      )}
                    </div>
                    {/* Countdown badge */}
                    <div className={`shrink-0 rounded-xl px-2.5 py-1 text-center ${
                      days <= 1 ? 'bg-red-500/15 text-red-400' :
                      days <= 7 ? 'bg-accent/15 text-accent' :
                      'bg-card-border/50 text-muted'
                    }`}>
                      <div className="text-sm font-bold tabular-nums leading-tight">
                        {days <= 0 ? 'Dziś' : days === 1 ? '1' : days}
                      </div>
                      {days > 1 && <div className="text-[10px] leading-tight">dni</div>}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <span>📅</span>
                      {formatEventDate(event.startAt)}
                    </span>
                    {event.locationName && (
                      <span className="flex items-center gap-1">
                        <span>📍</span>
                        {event.locationName}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <span>👥</span>
                      {event._count.attendees}
                      {event.maxAttendees ? ` / ${event.maxAttendees}` : ''}
                      {' '}idzie
                    </span>
                  </div>

                  {/* Attendance buttons */}
                  <div className="mt-3 flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      disabled={isLoading}
                      onClick={() => attend(event.id, isGoing ? 'NOT_GOING' : 'GOING')}
                      className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
                        isGoing
                          ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30'
                          : 'bg-card-border/50 text-muted hover:text-foreground hover:bg-card-border'
                      } disabled:opacity-50`}
                    >
                      {isGoing ? '✓ Idę' : 'Idę'}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      disabled={isLoading}
                      onClick={() => attend(event.id, isMaybe ? 'NOT_GOING' : 'MAYBE')}
                      className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
                        isMaybe
                          ? 'bg-amber-600/20 text-amber-400 hover:bg-amber-600/30'
                          : 'bg-card-border/50 text-muted hover:text-foreground hover:bg-card-border'
                      } disabled:opacity-50`}
                    >
                      {isMaybe ? '? Może' : 'Może'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
