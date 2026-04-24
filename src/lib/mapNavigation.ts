// Shared types and pure helpers for navigation logic in MapView

export interface NavStep {
  instruction: string;
  type: string;
  modifier?: string;
  distance: number;
  duration: number;
  name: string;
  maneuverLocation: [number, number]; // [lng, lat]
  bearingBefore: number;
  bearingAfter: number;
}

export function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return `${h} godz. ${m} min`;
  return `${Math.max(1, m)} min`;
}

export function fmtETA(sec: number): string {
  const d = new Date();
  d.setSeconds(d.getSeconds() + sec);
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSteps(data: any): NavStep[] {
  if (!data.routes?.[0]?.legs) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.routes[0].legs.flatMap((leg: any) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    leg.steps.map((s: any): NavStep => ({
      instruction: s.maneuver?.instruction ?? '',
      type: s.maneuver?.type ?? 'continue',
      modifier: s.maneuver?.modifier,
      distance: s.distance ?? 0,
      duration: s.duration ?? 0,
      name: s.name ?? '',
      maneuverLocation: s.maneuver?.location ?? [0, 0],
      bearingBefore: s.maneuver?.bearing_before ?? 0,
      bearingAfter: s.maneuver?.bearing_after ?? 0,
    }))
  );
}

export function getArrowRotation(type: string, modifier = ''): number {
  if (type === 'arrive' || type === 'depart') return 0;
  if (modifier.includes('uturn')) return 180;
  if (modifier.includes('sharp right')) return 135;
  if (modifier.includes('sharp left')) return -135;
  if (modifier.includes('slight right')) return 30;
  if (modifier.includes('slight left')) return -30;
  if (modifier.includes('right')) return 90;
  if (modifier.includes('left')) return -90;
  return 0;
}

export function fmtTripTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
