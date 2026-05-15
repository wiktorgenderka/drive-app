'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface DayData {
  label: string;
  km: number;
  minutes: number;
  trips: number;
}

export default function WeeklyChart() {
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'km' | 'time'>('km');

  useEffect(() => {
    fetch('/api/stats/weekly')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: DayData[]) => { setDays(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    );
  }

  const values = days.map((d) => mode === 'km' ? d.km : d.minutes);
  const maxVal = Math.max(...values, 1);
  const totalKm = days.reduce((s, d) => s + d.km, 0);
  const totalMin = days.reduce((s, d) => s + d.minutes, 0);
  const activeDays = days.filter((d) => d.km > 0).length;
  const todayIdx = days.length - 1;

  function fmtMin(min: number): string {
    if (min === 0) return '0m';
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-card-border bg-card-bg p-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ostatnie 7 dni</p>
          <p className="mt-0.5 text-base font-extrabold text-foreground tabular-nums">
            {mode === 'km'
              ? `${totalKm.toFixed(1)} km`
              : fmtMin(totalMin)}
          </p>
        </div>
        <div className="flex rounded-lg bg-input-bg p-0.5">
          {(['km', 'time'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${mode === m ? 'bg-card-bg text-foreground shadow' : 'text-muted hover:text-foreground'}`}
            >
              {m === 'km' ? 'km' : 'czas'}
            </button>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-1.5" style={{ height: 80 }}>
        {days.map((day, i) => {
          const val = mode === 'km' ? day.km : day.minutes;
          const pct = val > 0 ? Math.max((val / maxVal) * 100, 6) : 0;
          const isToday = i === todayIdx;
          const hasData = val > 0;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="relative flex w-full flex-1 items-end">
                <motion.div
                  className={`w-full rounded-t-md ${
                    isToday
                      ? 'bg-accent'
                      : hasData
                      ? 'bg-accent/40'
                      : 'bg-card-border/40'
                  }`}
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 24 }}
                  style={{ minHeight: hasData ? 4 : 2 }}
                />
              </div>
              <span className={`text-[9px] font-medium ${isToday ? 'text-accent' : 'text-muted'}`}>
                {day.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary pills */}
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col items-center rounded-xl bg-input-bg py-2">
          <span className="text-sm font-extrabold text-foreground tabular-nums">{activeDays}</span>
          <span className="text-[10px] text-muted">aktywne dni</span>
        </div>
        <div className="flex flex-1 flex-col items-center rounded-xl bg-input-bg py-2">
          <span className="text-sm font-extrabold text-foreground tabular-nums">
            {activeDays > 0 ? (totalKm / activeDays).toFixed(1) : '0'}
          </span>
          <span className="text-[10px] text-muted">km / dzień</span>
        </div>
        <div className="flex flex-1 flex-col items-center rounded-xl bg-input-bg py-2">
          <span className="text-sm font-extrabold text-foreground tabular-nums">
            {days.reduce((s, d) => s + d.trips, 0)}
          </span>
          <span className="text-[10px] text-muted">podróże</span>
        </div>
      </div>
    </div>
  );
}
