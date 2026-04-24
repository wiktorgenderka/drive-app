import { describe, it, expect } from 'vitest';
import { haversineMeters } from '@/lib/geo';

describe('haversineMeters', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineMeters(52, 21, 52, 21)).toBe(0);
  });

  it('returns positive distance for different coordinates', () => {
    const d = haversineMeters(52.2297, 21.0122, 50.0614, 19.9366); // Warszawa → Kraków
    expect(d).toBeGreaterThan(250_000); // >250 km
    expect(d).toBeLessThan(300_000);    // <300 km
  });

  it('is symmetric', () => {
    const d1 = haversineMeters(52, 21, 51, 20);
    const d2 = haversineMeters(51, 20, 52, 21);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
  });
});
