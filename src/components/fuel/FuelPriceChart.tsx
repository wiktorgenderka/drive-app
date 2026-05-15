'use client';

import { useEffect, useState } from 'react';
import { FUEL_TYPE_LABELS } from '@/types';

interface HistoryPoint {
  fuelType: string;
  price: number;
  recordedAt: string;
}

function Sparkline({ points, width = 200, height = 50 }: { points: number[]; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  const lastY = parseFloat(coords[coords.length - 1].split(',')[1]);
  const lastX = parseFloat(coords[coords.length - 1].split(',')[0]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12">
      <polyline points={coords.join(' ')} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill="#f59e0b" />
    </svg>
  );
}

export default function FuelPriceChart({ stationId }: { stationId: string }) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/fuel/${stationId}/history?days=${days}`)
      .then((r) => r.json())
      .then((data) => setHistory(data.history ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, [stationId, days]);

  const byType = history.reduce<Record<string, HistoryPoint[]>>((acc, p) => {
    if (!acc[p.fuelType]) acc[p.fuelType] = [];
    acc[p.fuelType].push(p);
    return acc;
  }, {});

  const types = Object.keys(byType);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-300">Historia cen</h4>
        <div className="flex gap-1">
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-2 py-0.5 rounded ${days === d ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-xs text-gray-500">Ładowanie...</p>}
      {!loading && types.length === 0 && (
        <p className="text-xs text-gray-500">Brak danych historycznych</p>
      )}

      {!loading && types.map((type) => {
        const pts = byType[type];
        const prices = pts.map((p) => p.price);
        const latest = prices[prices.length - 1];
        const first = prices[0];
        const diff = latest - first;
        return (
          <div key={type} className="mb-3">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-gray-400">{FUEL_TYPE_LABELS[type as keyof typeof FUEL_TYPE_LABELS] ?? type}</span>
              <span className={`text-xs font-medium ${diff > 0 ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-gray-400'}`}>
                {diff > 0 ? '+' : ''}{diff.toFixed(2)} zł
              </span>
            </div>
            <Sparkline points={prices} />
          </div>
        );
      })}
    </div>
  );
}
