'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string | null;
  photos: string[];
  horsepower: number | null;
  torque: number | null;
  engine: string | null;
  mods: string | null;
  isActive: boolean;
}

interface AddForm {
  make: string;
  model: string;
  year: string;
  color: string;
  horsepower: string;
  torque: string;
  engine: string;
  mods: string;
}

const EMPTY_FORM: AddForm = {
  make: '', model: '', year: new Date().getFullYear().toString(),
  color: '', horsepower: '', torque: '', engine: '', mods: '',
};

const CAR_COLORS = [
  { label: 'Czarny', hex: '#1a1a1a' }, { label: 'Biały', hex: '#f5f5f5' },
  { label: 'Srebrny', hex: '#a0a0a0' }, { label: 'Szary', hex: '#6b7280' },
  { label: 'Czerwony', hex: '#ef4444' }, { label: 'Niebieski', hex: '#3b82f6' },
  { label: 'Zielony', hex: '#22c55e' }, { label: 'Żółty', hex: '#eab308' },
  { label: 'Pomarańczowy', hex: '#f97316' }, { label: 'Brązowy', hex: '#92400e' },
];

export default function GaragePanel() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        const data: Vehicle[] = await res.json();
        setVehicles(data);
        const activeIdx = data.findIndex((v) => v.isActive);
        if (activeIdx !== -1) setSelectedIdx(activeIdx);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          make: form.make,
          model: form.model,
          year: parseInt(form.year),
          color: form.color || undefined,
          horsepower: form.horsepower ? parseInt(form.horsepower) : undefined,
          torque: form.torque ? parseInt(form.torque) : undefined,
          engine: form.engine || undefined,
          mods: form.mods || undefined,
          isActive: vehicles.length === 0,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.formErrors?.[0] ?? 'Błąd zapisu');
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      await fetchVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu');
    }
    setSaving(false);
  }

  async function setActive(id: string) {
    await fetch(`/api/vehicles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: true }),
    });
    await fetchVehicles();
  }

  async function deleteVehicle(id: string) {
    await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
    setSelectedIdx(0);
    await fetchVehicles();
  }

  const selected = vehicles[selectedIdx] ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">Twój Garaż</h3>
          <p className="text-xs text-muted">{vehicles.length} {vehicles.length === 1 ? 'pojazd' : 'pojazdy'}</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { setShowForm(!showForm); setError(null); }}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white shadow-lg transition hover:opacity-90"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          Dodaj auto
        </motion.button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            onSubmit={handleAdd}
            className="overflow-hidden rounded-2xl border border-accent/30 bg-card-bg"
          >
            <div className="p-5">
              <h4 className="mb-4 text-sm font-bold text-foreground">Nowy pojazd</h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted">Marka *</label>
                    <input
                      required
                      value={form.make}
                      onChange={(e) => setForm({ ...form, make: e.target.value })}
                      placeholder="np. BMW"
                      className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted">Model *</label>
                    <input
                      required
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      placeholder="np. M3"
                      className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted">Rok *</label>
                  <input
                    required
                    type="number"
                    min={1900}
                    max={new Date().getFullYear() + 1}
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: e.target.value })}
                    className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Kolor</label>
                  <select
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                  >
                    <option value="">Wybierz…</option>
                    {CAR_COLORS.map((c) => (
                      <option key={c.hex} value={c.label}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-muted">Moc (KM)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.horsepower}
                    onChange={(e) => setForm({ ...form, horsepower: e.target.value })}
                    placeholder="np. 500"
                    className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted">Moment (Nm)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.torque}
                    onChange={(e) => setForm({ ...form, torque: e.target.value })}
                    placeholder="np. 650"
                    className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-muted">Silnik</label>
                  <input
                    value={form.engine}
                    onChange={(e) => setForm({ ...form, engine: e.target.value })}
                    placeholder="np. 3.0L Inline-6 Turbo"
                    className="w-full rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-muted">Modyfikacje</label>
                  <textarea
                    rows={2}
                    value={form.mods}
                    onChange={(e) => setForm({ ...form, mods: e.target.value })}
                    placeholder="Opisz modyfikacje…"
                    className="w-full resize-none rounded-xl border border-input-border bg-input-bg px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent"
                  />
                </div>
              </div>

              {error && (
                <p className="mt-3 text-xs text-red-400">{error}</p>
              )}

              <div className="mt-4 flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Zapisywanie…' : 'Dodaj do garażu'}
                </motion.button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(null); }}
                  className="rounded-xl border border-card-border px-4 py-2.5 text-sm text-muted transition hover:text-foreground"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Vehicles carousel */}
      {vehicles.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-card-border bg-card-bg/50 py-12 text-center"
        >
          <span className="text-5xl">🚗</span>
          <div>
            <p className="text-sm font-semibold text-foreground">Garaż jest pusty</p>
            <p className="mt-1 text-xs text-muted">Dodaj swoje pierwsze auto żeby śledzić statystyki jazdy</p>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Selector dots */}
          {vehicles.length > 1 && (
            <div className="flex items-center justify-center gap-2">
              {vehicles.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedIdx(i)}
                  className="relative"
                >
                  <motion.div
                    animate={{ width: selectedIdx === i ? 20 : 8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className={`h-2 rounded-full transition-colors ${selectedIdx === i ? 'bg-accent' : 'bg-card-border'}`}
                  />
                  {v.isActive && (
                    <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Vehicle card */}
          <AnimatePresence mode="wait">
            {selected && (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="rounded-2xl border border-card-border bg-card-bg overflow-hidden"
              >
                {/* Car header */}
                <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 pb-8">
                  {selected.isActive && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-emerald-600/20 px-2.5 py-1 backdrop-blur-sm">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-semibold text-emerald-400">Aktywne</span>
                    </div>
                  )}
                  <div className="text-5xl mb-3">🚗</div>
                  <h3 className="text-xl font-bold text-white">{selected.make} {selected.model}</h3>
                  <p className="text-sm text-zinc-400">{selected.year}{selected.color ? ` · ${selected.color}` : ''}</p>
                  {selected.engine && (
                    <p className="mt-1 text-xs text-zinc-500">{selected.engine}</p>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 divide-x divide-card-border border-t border-card-border">
                  <div className="flex flex-col items-center py-4">
                    <span className="text-xl font-bold text-foreground tabular-nums">
                      {selected.horsepower ?? '—'}
                    </span>
                    <span className="text-xs text-muted">KM</span>
                  </div>
                  <div className="flex flex-col items-center py-4">
                    <span className="text-xl font-bold text-foreground tabular-nums">
                      {selected.torque ?? '—'}
                    </span>
                    <span className="text-xs text-muted">Nm</span>
                  </div>
                </div>

                {/* Mods */}
                {selected.mods && (
                  <div className="border-t border-card-border px-5 py-4">
                    <p className="mb-1 text-xs font-semibold text-muted uppercase tracking-wide">Modyfikacje</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{selected.mods}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 border-t border-card-border p-4">
                  {!selected.isActive && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setActive(selected.id)}
                      className="flex-1 rounded-xl bg-emerald-600/15 py-2.5 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-600/25"
                    >
                      Ustaw aktywne
                    </motion.button>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      if (window.confirm(`Usunąć ${selected.make} ${selected.model}?`)) {
                        deleteVehicle(selected.id);
                      }
                    }}
                    className="rounded-xl border border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
                  >
                    Usuń
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Swipe hint for multiple */}
          {vehicles.length > 1 && (
            <div className="flex items-center justify-center gap-4 pb-2">
              <button
                onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}
                disabled={selectedIdx === 0}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-card-border text-muted transition hover:text-foreground disabled:opacity-30"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="text-xs text-muted">{selectedIdx + 1} / {vehicles.length}</span>
              <button
                onClick={() => setSelectedIdx(Math.min(vehicles.length - 1, selectedIdx + 1))}
                disabled={selectedIdx === vehicles.length - 1}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-card-border text-muted transition hover:text-foreground disabled:opacity-30"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
