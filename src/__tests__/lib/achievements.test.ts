import { describe, it, expect } from 'vitest';
import { ACHIEVEMENTS } from '@/lib/achievements';

describe('ACHIEVEMENTS', () => {
  it('has no duplicate keys', () => {
    const keys = ACHIEVEMENTS.map((a) => a.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('all achievements have positive xpReward or 0', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.xpReward).toBeGreaterThanOrEqual(0);
    }
  });

  it('all rarities are valid', () => {
    const valid = new Set(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
    for (const a of ACHIEVEMENTS) {
      expect(valid.has(a.rarity)).toBe(true);
    }
  });

  it('all achievements have non-empty required fields', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.key.length).toBeGreaterThan(0);
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(a.emoji.length).toBeGreaterThan(0);
    }
  });

  it('has at least 20 achievements', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(20);
  });
});
