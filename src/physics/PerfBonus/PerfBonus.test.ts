import { describe, expect, it } from 'vitest';
import { bhopCarryWeight } from './PerfBonus';

describe('bhopCarryWeight', () => {
  it('gives full carry at 0 frames late, decaying by framePenalty per frame late', () => {
    expect(bhopCarryWeight(0, 12, 0.975)).toBe(1);
    expect(bhopCarryWeight(1, 12, 0.975)).toBeCloseTo(0.975, 10);
    expect(bhopCarryWeight(2, 12, 0.975)).toBeCloseTo(0.975 ** 2, 10);
    expect(bhopCarryWeight(12, 12, 0.975)).toBeCloseTo(0.975 ** 12, 10);
  });

  it('hard-cuts to 0 past maxBhopFrames — a discontinuity, not a taper', () => {
    expect(bhopCarryWeight(13, 12, 0.975)).toBe(0);
    expect(bhopCarryWeight(100, 12, 0.975)).toBe(0);
  });

  it('a negative frame count (shouldn\'t happen, but) is treated as no carry', () => {
    expect(bhopCarryWeight(-1, 12, 0.975)).toBe(0);
  });
});
