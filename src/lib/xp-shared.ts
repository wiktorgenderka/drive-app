export const LEVELS = [
  { level: 1,  name: 'Debiutant',         minXP: 0 },
  { level: 2,  name: 'Kierowca',          minXP: 500 },
  { level: 3,  name: 'Entuzjasta',        minXP: 1_500 },
  { level: 4,  name: 'Weteran Dróg',      minXP: 3_500 },
  { level: 5,  name: 'Asfalciarz',        minXP: 7_000 },
  { level: 6,  name: 'Drift King',        minXP: 13_000 },
  { level: 7,  name: 'Kanionowy Lis',     minXP: 22_000 },
  { level: 8,  name: 'Legenda Szos',      minXP: 35_000 },
  { level: 9,  name: 'Mistrzowska Klasa', minXP: 55_000 },
  { level: 10, name: 'Road God',          minXP: 100_000 },
] as const;

export function getLevelInfo(totalXP: number) {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  let next: (typeof LEVELS)[number] | null = LEVELS[1];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVELS[i].minXP) {
      current = LEVELS[i];
      next = i < LEVELS.length - 1 ? LEVELS[i + 1] : null;
      break;
    }
  }

  const xpInLevel = totalXP - current.minXP;
  const xpNeeded = next ? next.minXP - current.minXP : 1;
  const progress = next ? Math.min((xpInLevel / xpNeeded) * 100, 100) : 100;

  return { current, next, xpInLevel, xpNeeded, progress };
}
