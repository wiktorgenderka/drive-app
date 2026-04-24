'use client';

import { useState, memo } from 'react';
import { Marker, Popup } from 'react-map-gl/mapbox';
import type { FuelStation } from '@/stores/useMapStore';
import { useMapStore } from '@/stores/useMapStore';

/* ─── Brand config ─────────────────────────────────────────────── */

const BRANDS: Record<string, { color: string; short: string; logo: string | null }> = {
  orlen:         { color: '#e22024', short: 'OR', logo: '/brands/orlen.png' },
  'pkn orlen':   { color: '#e22024', short: 'OR', logo: '/brands/orlen.png' },
  bp:            { color: '#009900', short: 'BP', logo: '/brands/bp.png' },
  shell:         { color: '#e8b020', short: 'SH', logo: '/brands/shell.png' },
  'circle k':    { color: '#cc0000', short: 'CK', logo: '/brands/circlek.png' },
  statoil:       { color: '#cc0000', short: 'ST', logo: '/brands/circlek.png' },
  lotos:         { color: '#003087', short: 'LO', logo: '/brands/lotos.png' },
  mol:           { color: '#0064b4', short: 'ML', logo: '/brands/mol.png' },
  amic:          { color: '#e4002b', short: 'AM', logo: '/brands/amic.png' },
  moya:          { color: '#00529b', short: 'MY', logo: '/brands/moya.png' },
  esso:          { color: '#0033a0', short: 'ES', logo: '/brands/esso.png' },
  total:         { color: '#c8102e', short: 'TL', logo: '/brands/total.png' },
  totalenergies: { color: '#c8102e', short: 'TL', logo: '/brands/total.png' },
  neste:         { color: '#00833e', short: 'NE', logo: '/brands/neste.png' },
};

function getBrand(brand?: string): { color: string; short: string; logo: string | null } {
  if (!brand || typeof brand !== 'string') return { color: '#10b981', short: '⛽', logo: null };
  const key = brand.toLowerCase().trim();
  for (const [pattern, val] of Object.entries(BRANDS)) {
    if (key.includes(pattern)) return val;
  }
  return { color: '#10b981', short: brand.slice(0, 2).toUpperCase(), logo: null };
}

/* ─── Fuel config ───────────────────────────────────────────────── */

const FUEL_TYPES = ['PETROL_95', 'PETROL_98', 'DIESEL', 'LPG'] as const;
type FT = typeof FUEL_TYPES[number];

const FUEL_META: Record<FT, { label: string; color: string; bg: string; border: string }> = {
  PETROL_95: { label: 'Pb 95',  color: '#16a34a', bg: '#16a34a1a', border: '#16a34a33' },
  PETROL_98: { label: 'Pb 98',  color: '#15803d', bg: '#15803d1a', border: '#15803d33' },
  DIESEL:    { label: 'Diesel', color: '#e5e7eb', bg: '#1f293780', border: '#374151'   },
  LPG:       { label: 'LPG',    color: '#3b82f6', bg: '#3b82f61a', border: '#3b82f633' },
};

function fmtPrice(p: number) {
  return p.toFixed(2).replace('.', ',') + ' zł';
}

/* ─── Fuel pump SVG path ────────────────────────────────────────── */
const PUMP_PATH =
  'M3 2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v2h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-1v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2zm2 1v4h6V3H5zm-1 6v5h8v-5H4zm9-4v1h1V6a1 1 0 0 0-1-1v1z';

/* ─── Component ─────────────────────────────────────────────────── */

function FuelStationMarker({ station }: { station: FuelStation }) {
  const [showPopup, setShowPopup] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeFT, setActiveFT] = useState<FT>('PETROL_95');
  const [priceInput, setPriceInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [logoError, setLogoError] = useState(false);
  const updateFuelStation = useMapStore((s) => s.updateFuelStation);
  const brand = getBrand(station.brand);
  const logoUrl = brand.logo;
  const priceMap = Object.fromEntries(station.prices.map((p) => [p.fuelType, p]));
  const availableFTs = FUEL_TYPES.filter((ft) => ft in priceMap);

  async function ensureDb(): Promise<string> {
    if (!station.isMapbox) return station.id;
    const res = await fetch('/api/fuel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
        address: station.address ?? null,
        brand: typeof station.brand === 'string' ? station.brand : null,
      }),
    });
    if (!res.ok) throw new Error('Nie można zapisać stacji');
    return (await res.json()).id as string;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(priceInput.replace(',', '.'));
    if (isNaN(num) || num <= 0 || num > 20) {
      setFeedback({ ok: false, msg: 'Podaj prawidłową cenę (np. 6,49)' });
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const id = await ensureDb();
      const res = await fetch(`/api/fuel/${id}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fuelType: activeFT, price: num }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Błąd serwera');
      const saved = await res.json();
      updateFuelStation({
        ...station,
        id: saved.stationId ?? station.id,
        isMapbox: false,
        prices: [
          ...station.prices.filter((p) => p.fuelType !== activeFT),
          { id: saved.id, fuelType: saved.fuelType, price: saved.price, updatedAt: Date.now() },
        ],
        lastUpdated: Date.now(),
      });
      setPriceInput('');
      setShowForm(false);
      setFeedback({ ok: true, msg: 'Cena zaktualizowana!' });
    } catch (err) {
      setFeedback({ ok: false, msg: err instanceof Error ? err.message : 'Błąd' });
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setShowPopup(false);
    setShowForm(false);
    setPriceInput('');
    setFeedback(null);
  }

  return (
    <>
      {/* ── Marker ─────────────────────────────────────────────── */}
      <Marker
        latitude={station.latitude}
        longitude={station.longitude}
        anchor="bottom"
        onClick={(e) => { e.originalEvent.stopPropagation(); setShowPopup(true); }}
      >
        <div className="flex flex-col items-center cursor-pointer select-none" style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.55))' }}>
          {/* Pin circle */}
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center border-[3px] border-white overflow-hidden"
            style={{ backgroundColor: logoUrl && !logoError ? '#fff' : brand.color }}
          >
            {logoUrl && !logoError ? (
              <img
                src={logoUrl}
                alt={brand.short}
                width={28}
                height={28}
                className="object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="text-white font-black text-[11px]">{brand.short}</span>
            )}
          </div>
          {/* Tip */}
          <div style={{
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: `7px solid ${logoUrl && !logoError ? '#fff' : brand.color}`,
            marginTop: -1,
          }} />
        </div>
      </Marker>

      {/* ── Popup ──────────────────────────────────────────────── */}
      {showPopup && (
        <Popup
          latitude={station.latitude}
          longitude={station.longitude}
          anchor="bottom"
          onClose={close}
          closeOnClick={false}
          offset={48}
          maxWidth="272px"
        >
          <div className="w-64">
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid #374151' }}>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10"
                style={{ backgroundColor: logoUrl && !logoError ? '#fff' : brand.color }}
              >
                {logoUrl && !logoError ? (
                  <img src={logoUrl} alt={brand.short} width={24} height={24} className="object-contain" />
                ) : (
                  <span className="text-white font-black text-[10px]">{brand.short}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-100 truncate leading-snug">{station.name}</p>
                {station.address && (
                  <p className="text-[11px] text-gray-500 truncate leading-snug mt-0.5">{station.address}</p>
                )}
              </div>
            </div>

            {/* Prices */}
            <div className="px-4 py-3">
              {availableFTs.length > 0 ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {availableFTs.map((ft) => {
                    const m = FUEL_META[ft];
                    return (
                      <div
                        key={ft}
                        className="rounded-lg px-3 py-2"
                        style={{ backgroundColor: m.bg, border: `1px solid ${m.border}` }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: m.color }}>
                          {m.label}
                        </p>
                        <p className="text-sm font-bold text-gray-100 mt-0.5">
                          {fmtPrice(priceMap[ft].price)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500 text-center py-0.5">Brak cen — bądź pierwszy!</p>
              )}
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`mx-4 mb-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                feedback.ok
                  ? 'text-green-400 border border-green-800/50'
                  : 'text-red-400 border border-red-800/50'
              }`} style={{ backgroundColor: feedback.ok ? '#14532d33' : '#7f1d1d33' }}>
                {feedback.msg}
              </div>
            )}

            {/* Add price */}
            <div className="px-4 pb-4" style={{ borderTop: '1px solid #374151' }}>
              {!showForm ? (
                <button
                  onClick={() => { setShowForm(true); setFeedback(null); }}
                  className="w-full mt-3 py-2 rounded-lg text-xs font-bold text-white transition-opacity hover:opacity-80 active:scale-95"
                  style={{ backgroundColor: brand.color }}
                >
                  + Dodaj / zaktualizuj cenę
                </button>
              ) : (
                <form onSubmit={handleSubmit} className="mt-3 space-y-2.5">
                  {/* Fuel type selector */}
                  <div className="grid grid-cols-4 gap-1">
                    {FUEL_TYPES.map((ft) => {
                      const m = FUEL_META[ft];
                      const active = activeFT === ft;
                      return (
                        <button
                          key={ft}
                          type="button"
                          onClick={() => setActiveFT(ft)}
                          className="py-1.5 rounded-lg text-[10px] font-bold transition-all leading-none"
                          style={active
                            ? { backgroundColor: m.color, color: ft === 'DIESEL' ? '#111' : '#fff', boxShadow: `0 0 0 2px ${m.color}55` }
                            : { backgroundColor: m.bg, color: m.color, border: `1px solid ${m.border}` }
                          }
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Price input */}
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5"
                    style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46' }}
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="np. 6,49"
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-gray-100 placeholder-gray-600 focus:outline-none"
                      autoFocus
                    />
                    <span className="text-xs text-gray-500">zł/l</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition-opacity disabled:opacity-40 hover:opacity-80"
                      style={{ backgroundColor: brand.color }}
                    >
                      {submitting ? 'Zapisuję…' : 'Zapisz'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setPriceInput(''); setFeedback(null); }}
                      className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-400 hover:text-gray-200 transition-colors"
                      style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46' }}
                    >
                      Anuluj
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </Popup>
      )}
    </>
  );
}

export default memo(FuelStationMarker, (prev, next) =>
  prev.station.id === next.station.id &&
  prev.station.prices.length === next.station.prices.length &&
  prev.station.lastUpdated === next.station.lastUpdated
);
