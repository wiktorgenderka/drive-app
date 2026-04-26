'use client';

import { useEffect, useState } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import { useMapStore } from '@/stores/useMapStore';
import { haversineMeters } from '@/lib/geo';

const MAX_DIST_METERS = 1000; // Pokazuj tylko gdy POI jest w promieniu 1 km od użytkownika.
const MAX_ITEMS = 5;          // Maksymalnie 5 najbliższych wskaźników, żeby nie zaśmiecać ekranu.
const EDGE_MARGIN = 56;       // Odstęp od fizycznej krawędzi mapy.

type Kind = 'report' | 'fuel';

interface EdgeItem {
  id: string;
  kind: Kind;
  x: number;
  y: number;
  angleDeg: number; // 0 = w prawo, 90 = w dół; pasuje do CSS rotate
  dist: number;
  color: string;
  label: string;
  iconPath: string;
}

const REPORT_META: Record<string, { color: string; label: string; iconPath: string }> = {
  POLICE:          { color: '#3b82f6', label: 'Policja',     iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  UNMARKED_POLICE: { color: '#6366f1', label: 'Tajniaki',    iconPath: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
  SPEED_TRAP:      { color: '#fbbf24', label: 'Kontrola',    iconPath: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z' },
  ACCIDENT:        { color: '#ef4444', label: 'Wypadek',     iconPath: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
  OBSTACLE:        { color: '#f97316', label: 'Przeszkoda',  iconPath: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  SPEED_CAMERA:    { color: '#a855f7', label: 'Fotoradar',   iconPath: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z' },
};

const FUEL_META = {
  color: '#10b981',
  label: 'Stacja',
  iconPath: 'M3 22V4a1 1 0 011-1h9a1 1 0 011 1v18M14 13h2a3 3 0 013 3v1a2 2 0 002 2h0a2 2 0 002-2V8.5L18 5M2 22h13',
};

export default function EdgePOIIndicators() {
  const map = useMap().current;
  const userLocation = useMapStore((s) => s.userLocation);
  const reports = useMapStore((s) => s.reports);
  const fuelStations = useMapStore((s) => s.fuelStations);
  const showReports = useMapStore((s) => s.showReports);
  const showFuelStations = useMapStore((s) => s.showFuelStations);
  const [items, setItems] = useState<EdgeItem[]>([]);

  useEffect(() => {
    const m = map?.getMap();
    if (!m || !userLocation) {
      setItems([]);
      return;
    }

    const compute = () => {
      const canvas = m.getCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w <= 0 || h <= 0) return;

      const cx = w / 2;
      const cy = h / 2;
      const halfW = Math.max(0, w / 2 - EDGE_MARGIN);
      const halfH = Math.max(0, h / 2 - EDGE_MARGIN);

      type Cand = { id: string; kind: Kind; lat: number; lng: number; meta: { color: string; label: string; iconPath: string } };
      const candidates: Cand[] = [];
      if (showReports) {
        for (const r of reports) {
          const meta = REPORT_META[r.type] ?? REPORT_META.OBSTACLE;
          candidates.push({ id: r.id, kind: 'report', lat: r.latitude, lng: r.longitude, meta });
        }
      }
      if (showFuelStations) {
        for (const s of fuelStations) {
          candidates.push({ id: s.id, kind: 'fuel', lat: s.latitude, lng: s.longitude, meta: { ...FUEL_META, label: s.brand ?? s.name ?? FUEL_META.label } });
        }
      }

      const next: EdgeItem[] = [];
      for (const c of candidates) {
        const dist = haversineMeters(userLocation.latitude, userLocation.longitude, c.lat, c.lng);
        if (dist > MAX_DIST_METERS) continue;
        const px = m.project([c.lng, c.lat]);
        const onScreen = px.x >= 0 && px.x <= w && px.y >= 0 && px.y <= h;
        if (onScreen) continue;

        const dx = px.x - cx;
        const dy = px.y - cy;
        if (dx === 0 && dy === 0) continue;
        const tx = dx === 0 ? Infinity : Math.abs(halfW / dx);
        const ty = dy === 0 ? Infinity : Math.abs(halfH / dy);
        const t = Math.min(tx, ty);
        const ex = cx + dx * t;
        const ey = cy + dy * t;
        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

        next.push({
          id: `${c.kind}-${c.id}`,
          kind: c.kind,
          x: ex,
          y: ey,
          angleDeg,
          dist,
          color: c.meta.color,
          label: c.meta.label,
          iconPath: c.meta.iconPath,
        });
      }

      // Posortuj po dystansie i obetnij do MAX_ITEMS — żeby przy tłoku pokazać tylko najbliższe.
      next.sort((a, b) => a.dist - b.dist);
      setItems(next.slice(0, MAX_ITEMS));
    };

    compute();
    m.on('move', compute);
    m.on('moveend', compute);
    return () => {
      m.off('move', compute);
      m.off('moveend', compute);
    };
  }, [map, userLocation, reports, fuelStations, showReports, showFuelStations]);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {items.map((it) => {
        const distLabel = it.dist < 1000 ? `${Math.round(it.dist)} m` : `${(it.dist / 1000).toFixed(1)} km`;
        return (
          <div
            key={it.id}
            className="absolute flex flex-col items-center"
            style={{ left: it.x, top: it.y, transform: 'translate(-50%, -50%)' }}
          >
            {/* Strzałka kierunkowa — zewnętrznie od ikony, wskazuje gdzie jest POI */}
            <span
              className="absolute"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) rotate(${it.angleDeg}deg) translateX(28px)`,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" style={{ filter: `drop-shadow(0 0 4px ${it.color})` }}>
                <path d="M0 0 L14 7 L0 14 Z" fill={it.color} />
              </svg>
            </span>
            {/* Główna ikonka POI */}
            <div
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-white"
              style={{
                background: it.color,
                border: '2px solid #ffffff',
                boxShadow: `0 0 0 3px ${it.color}55, 0 0 14px ${it.color}, 0 2px 4px rgba(0,0,0,0.55)`,
              }}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d={it.iconPath} />
              </svg>
            </div>
            {/* Pigułka z dystansem */}
            <span
              className="mt-1 rounded-md px-1.5 py-0.5 text-[10px] font-black tabular-nums text-white"
              style={{
                background: 'rgba(0,0,0,0.78)',
                boxShadow: `0 0 6px ${it.color}55`,
              }}
            >
              {distLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
