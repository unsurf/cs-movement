import { describe, expect, it } from 'vitest';
import { applyAirSpeedCeiling, bhopCarryWeight } from './PerfBonus';

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

describe('applyAirSpeedCeiling', () => {
  it('passes speeds at or below the ceiling through untouched', () => {
    expect(applyAirSpeedCeiling(200, 390, 50)).toBe(200);
    expect(applyAirSpeedCeiling(390, 390, 50)).toBe(390);
  });

  it('squeezes speeds above the ceiling; each additional unit of input gains less than the last', () => {
    const at100Over = applyAirSpeedCeiling(490, 390, 50);
    const at1000Over = applyAirSpeedCeiling(1390, 390, 50);
    expect(at100Over).toBeGreaterThan(390);
    expect(at100Over).toBeLessThan(490); // squeezed down from the raw value
    expect(at1000Over).toBeGreaterThan(at100Over); // more excess still ends up higher overall...
    // ...but the marginal return shrinks: the next 900 units of excess (100
    // over -> 1000 over) buy far less than the first 100 did.
    const firstStepGain = at100Over - 390;
    const secondStepGain = at1000Over - at100Over;
    expect(secondStepGain).toBeLessThan(firstStepGain);
  });

  it('asymptotes toward ceiling + softness, never much past it however large the input', () => {
    expect(applyAirSpeedCeiling(1_000_000, 390, 50)).toBeLessThan(390 + 50 + 0.01);
    expect(applyAirSpeedCeiling(1_000_000, 390, 50)).toBeGreaterThan(390 + 49.9);
  });
});
