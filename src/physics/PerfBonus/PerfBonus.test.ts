import { describe, expect, it } from 'vitest';
import { perfBonusFactor } from './PerfBonus';

describe('perfBonusFactor', () => {
  it('gives the full bonus at 0 ticks late, tapering to 0 at the window edge', () => {
    expect(perfBonusFactor(0, 4, 0.2)).toBe(0.2);
    expect(perfBonusFactor(2, 4, 0.2)).toBeCloseTo(0.1, 10);
    expect(perfBonusFactor(4, 4, 0.2)).toBe(0);
    expect(perfBonusFactor(10, 4, 0.2)).toBe(0);
  });

  it('a zero-width window only rewards a 0-tick takeoff', () => {
    expect(perfBonusFactor(0, 0, 0.2)).toBe(0.2);
    expect(perfBonusFactor(1, 0, 0.2)).toBe(0);
  });
});
