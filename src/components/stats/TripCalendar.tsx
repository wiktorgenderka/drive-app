'use client';

import { useState, useEffect } from 'react';

interface DayData {
  date: string;
  km: number;
}

function getLevel(km: number): 0 | 1 | 2 | 3 | 4 {
  if (km === 0) return 0;
  if (km < 20) return 1;
  if (km < 50) return 2;
  if (km < 100) return 3;
  return 4;
}

const LEVEL_CLASSES = [
  'bg-card-border/40',
  'bg-accent/25',
  'bg-accent/50',
  'bg-accent/75',
  'bg-accent',
];

const MONTHS_PL = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
const DAYS_PL = ['Pn', 'Śr', 'Pt'];

export default function TripCalendar() {
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ date: string; km: number } | null>(null);

  useEffect(() => {
    fetch('/api/stats/calendar')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setDays(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
      </div>
    );
  }

  if (days.length === 0) return null;

  // Pad front to align to Monday
  const firstDate = new Date(days[0].date);
  const firstDow = (firstDate.getDay() + 6) % 7; // 0=Mon
  const padded: (DayData | null)[] = [
    ...Array(firstDow).fill(null),
    ...days,
  ];

  // Split into weeks (columns)
  const weeks: (DayData | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  // Build month labels
  const monthLabels: { col: number; label: string }[] = [];
  weeks.forEach((week, col) => {
    const firstReal = week.find((d) => d !== null);
    if (!firstReal) return;
    const d = new Date(firstReal.date);
    if (d.getDate() <= 7) {
      monthLabels.push({ col, label: MONTHS_PL[d.getMonth()] });
    }
  });

  const totalKm = days.reduce((s, d) => s + d.km, 0);
  const activeDays = days.filter((d) => d.km > 0).length;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-card-border bg-card-bg p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Aktywność (90 dni)</p>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span><span className="font-bold text-foreground">{activeDays}</span> dni aktywnych</span>
          <span><span className="font-bold text-accent tabular-nums">{totalKm.toFixed(0)} km</span></span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="relative">
        {/* Month labels */}
        <div className="mb-1 flex" style={{ paddingLeft: 20 }}>
          {weeks.map((_, col) => {
            const label = monthLabels.find((m) => m.col === col);
            return (
              <div key={col} className="flex-1 text-center">
                {label ? <span className="text-[9px] text-muted">{label.label}</span> : null}
              </div>
            );
          })}
        </div>

        <div className="flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col justify-between" style={{ width: 16, paddingTop: 1, paddingBottom: 1, gap: 1 }}>
            {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
              <div key={dow} className="flex items-center" style={{ height: 10 }}>
                {dow === 0 || dow === 2 || dow === 4 ? (
                  <span className="text-[8px] text-muted leading-none">{DAYS_PL[dow === 0 ? 0 : dow === 2 ? 1 : 2]}</span>
                ) : null}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="flex flex-1 gap-0.5">
            {weeks.map((week, col) => (
              <div key={col} className="flex flex-1 flex-col gap-0.5">
                {week.map((day, row) => {
                  if (!day) {
                    return <div key={row} className="aspect-square w-full rounded-[2px] bg-transparent" />;
                  }
                  const level = getLevel(day.km);
                  const isToday = day.date === new Date().toISOString().slice(0, 10);
                  return (
                    <div
                      key={row}
                      className={`aspect-square w-full cursor-pointer rounded-[2px] transition-opacity hover:opacity-80 ${LEVEL_CLASSES[level]} ${isToday ? 'ring-1 ring-accent ring-offset-1 ring-offset-card-bg' : ''}`}
                      onMouseEnter={() => setTooltip(day)}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-card-border bg-card-bg px-2.5 py-1 shadow-lg text-[11px]">
            <span className="text-muted">{new Date(tooltip.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</span>
            <span className="ml-2 font-bold text-foreground tabular-nums">
              {tooltip.km > 0 ? `${tooltip.km.toFixed(1)} km` : 'Brak aktywności'}
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-[9px] text-muted">Mniej</span>
        {LEVEL_CLASSES.map((cls, i) => (
          <div key={i} className={`h-2.5 w-2.5 rounded-[2px] ${cls}`} />
        ))}
        <span className="text-[9px] text-muted">Więcej</span>
      </div>
    </div>
  );
}
