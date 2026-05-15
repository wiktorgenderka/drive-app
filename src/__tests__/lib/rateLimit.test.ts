import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import fresh module each test by resetting the store
let rateLimit: (key: string, limit: number, windowMs: number) => boolean;

describe('rateLimit', () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/rateLimit');
    rateLimit = mod.rateLimit;
  });

  it('allows requests within the limit', () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit('test-key', 5, 60_000)).toBe(true);
    }
  });

  it('blocks when limit is exceeded', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('block-key', 5, 60_000);
    }
    expect(rateLimit('block-key', 5, 60_000)).toBe(false);
  });

  it('uses separate buckets per key', () => {
    for (let i = 0; i < 5; i++) {
      rateLimit('key-a', 5, 60_000);
    }
    // key-b is independent
    expect(rateLimit('key-b', 5, 60_000)).toBe(true);
  });

  it('allows again after window expires', () => {
    const key = 'window-key';
    // Exhaust the limit with a 1ms window
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 1);
    }
    expect(rateLimit(key, 3, 1)).toBe(false);

    // Wait for window to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(rateLimit(key, 3, 1)).toBe(true);
        resolve();
      }, 5);
    });
  });
});
