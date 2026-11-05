import { describe, expect, it } from 'vitest';
import { vec3, length } from '../../math/vec3';
import { clipVelocity } from './ClipVelocity';

const S = Math.SQRT1_2;

describe('clipVelocity', () => {
  it('removes exactly the into-plane component at overbounce 1.0', () => {
    const vel = vec3(100, -300, 0);
    clipVelocity(vel, vec3(0, 1, 0), 1.0);
    expect(vel.x).toBe(100);
    expect(vel.y).toBe(0);
  });

  it('pushes out by at least DIST_EPSILON when a residual into-plane component is left', () => {
    const vel = vec3(0, -0.01, 0);
    clipVelocity(vel, vec3(0, 1, 0), 0);
    // adjust = min(-0.01, -DIST_EPSILON) = -0.03125 -> y = -0.01 + 0.03125
    expect(vel.y).toBeCloseTo(0.02125, 6);
  });

  it('preserves along-plane speed on a 45° surf ramp', () => {
    const vel = vec3(0, -500, 0);
    clipVelocity(vel, vec3(0, S, S), 1.0);
    expect(vel.y).toBeCloseTo(-250, 4);
    expect(vel.z).toBeCloseTo(250, 4);
    // |v| after = 500 * cos(45°): falling into a ramp converts downward
    // speed into along-ramp speed without loss.
    expect(length(vel)).toBeCloseTo(500 * S, 4);
  });
});
