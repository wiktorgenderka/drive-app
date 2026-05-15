import { describe, it, expect } from 'vitest';
import { LEVELS, getLevelInfo } from '@/lib/xp-shared';

describe('LEVELS', () => {
  it('has 10 levels', () => {
    expect(LEVELS.length).toBe(10);
  });

  it('starts at 0 XP', () => {
    expect(LEVELS[0].minXP).toBe(0);
  });

  it('is sorted in ascending XP order', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].minXP).toBeGreaterThan(LEVELS[i - 1].minXP);
    }
  });

  it('max level requires 100k XP', () => {
    expect(LEVELS[LEVELS.length - 1].minXP).toBe(100_000);
  });

  it('all levels have non-empty names', () => {
    for (const l of LEVELS) {
      expect(l.name.length).toBeGreaterThan(0);
    }
  });
});

describe('getLevelInfo', () => {
  it('returns level 1 at 0 XP', () => {
    const { current } = getLevelInfo(0);
    expect(current.level).toBe(1);
  });

  it('returns level 1 at 499 XP', () => {
    const { current } = getLevelInfo(499);
    expect(current.level).toBe(1);
  });

  it('returns level 2 at exactly 500 XP', () => {
    const { current } = getLevelInfo(500);
    expect(current.level).toBe(2);
  });

  it('returns level 10 at 100k XP', () => {
    const { current } = getLevelInfo(100_000);
    expect(current.level).toBe(10);
  });

  it('returns level 10 at 200k XP', () => {
    const { current } = getLevelInfo(200_000);
    expect(current.level).toBe(10);
  });

  it('returns null for next at max level', () => {
    const { next } = getLevelInfo(100_000);
    expect(next).toBeNull();
  });

  it('returns correct next level at level 1', () => {
    const { next } = getLevelInfo(0);
    expect(next?.level).toBe(2);
    expect(next?.minXP).toBe(500);
  });

  it('progress is 0% at start of a level', () => {
    const { progress } = getLevelInfo(500);
    expect(progress).toBe(0);
  });

  it('progress is 100% at max level', () => {
    const { progress } = getLevelInfo(100_000);
    expect(progress).toBe(100);
  });

  it('progress is 50% halfway through level', () => {
    // Level 1: 0–500. Halfway = 250.
    const { progress } = getLevelInfo(250);
    expect(progress).toBeCloseTo(50, 0);
  });

  it('xpInLevel reflects XP earned within current level', () => {
    const { xpInLevel } = getLevelInfo(600);
    expect(xpInLevel).toBe(100); // 600 - 500 = 100
  });

  it('xpNeeded is the range to next level', () => {
    // Level 2: 500–1500 → range = 1000
    const { xpNeeded } = getLevelInfo(500);
    expect(xpNeeded).toBe(1000);
  });
});
