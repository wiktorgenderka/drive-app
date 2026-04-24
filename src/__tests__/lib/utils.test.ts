import { describe, it, expect } from 'vitest';
import { cn, timeAgo, formatDistance } from '@/lib/utils';

describe('cn()', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('resolves Tailwind conflicts (last wins)', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('ignores falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar');
  });
});

describe('formatDistance()', () => {
  it('returns meters for <1000m', () => {
    expect(formatDistance(500)).toBe('500 m');
  });

  it('returns km for >=1000m', () => {
    expect(formatDistance(1500)).toBe('1.5 km');
  });
});

describe('timeAgo()', () => {
  it('returns "przed chwilą" for recent timestamps', () => {
    expect(timeAgo(Date.now() - 10_000)).toBe('przed chwilą');
  });

  it('returns minutes ago', () => {
    expect(timeAgo(Date.now() - 5 * 60 * 1000)).toBe('5 min temu');
  });
});
