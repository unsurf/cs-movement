import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { checkVelocity } from './CheckVelocity';
import { MAX_VELOCITY } from './CheckVelocity.config';

describe('checkVelocity (sv_maxvelocity)', () => {
  it('clamps each axis independently to ±3500', () => {
    const vel = vec3(9000, -9000, 100);
    checkVelocity(vel);
    expect(vel.x).toBe(MAX_VELOCITY);
    expect(vel.y).toBe(-MAX_VELOCITY);
    expect(vel.z).toBe(100);
  });

  it('replaces NaN with 0', () => {
    const vel = vec3(Number.NaN, 5, 0);
    checkVelocity(vel);
    expect(vel.x).toBe(0);
    expect(vel.y).toBe(5);
  });
});
