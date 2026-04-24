import { describe, it, expect } from 'vitest';
import { fmtDist, fmtTime, fmtTripTime, getArrowRotation } from '@/lib/mapNavigation';

describe('fmtDist()', () => {
  it('formats meters below 1000', () => {
    expect(fmtDist(350)).toBe('350 m');
    expect(fmtDist(123)).toBe('120 m'); // rounded to 10s
  });

  it('formats kilometers', () => {
    expect(fmtDist(1500)).toBe('1.5 km');
    expect(fmtDist(10000)).toBe('10.0 km');
  });
});

describe('fmtTime()', () => {
  it('formats minutes', () => {
    expect(fmtTime(90)).toBe('2 min');
    expect(fmtTime(30)).toBe('1 min'); // min 1
  });

  it('formats hours + minutes', () => {
    expect(fmtTime(3700)).toBe('1 godz. 2 min');
  });
});

describe('fmtTripTime()', () => {
  it('formats MM:SS when under 1 hour', () => {
    expect(fmtTripTime(65)).toBe('01:05');
  });

  it('formats HH:MM:SS when over 1 hour', () => {
    expect(fmtTripTime(3661)).toBe('1:01:01');
  });
});

describe('getArrowRotation()', () => {
  it('returns 0 for straight/arrive/depart', () => {
    expect(getArrowRotation('arrive')).toBe(0);
    expect(getArrowRotation('continue')).toBe(0);
  });

  it('returns 90 for right turn', () => {
    expect(getArrowRotation('turn', 'right')).toBe(90);
  });

  it('returns -90 for left turn', () => {
    expect(getArrowRotation('turn', 'left')).toBe(-90);
  });

  it('returns 180 for u-turn', () => {
    expect(getArrowRotation('turn', 'uturn')).toBe(180);
  });
});
