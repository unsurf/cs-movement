import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { applyFriction } from './Friction';

const DT = 1 / 128;

describe('applyFriction', () => {
  it('drops speed proportionally above stopspeed', () => {
    const vel = vec3(250, 0, 0);
    applyFriction(vel, 4, 100, DT);
    // drop = 250 * 4 / 128 = 7.8125
    expect(vel.x).toBeCloseTo(242.1875, 4);
  });

  it('uses stopspeed as control below stopspeed', () => {
    const vel = vec3(50, 0, 0);
    applyFriction(vel, 4, 100, DT);
    // drop = 100 * 4 / 128 = 3.125
    expect(vel.x).toBeCloseTo(46.875, 4);
  });

  it('clamps to zero at very low speeds', () => {
    const vel = vec3(2, 0, 0);
    applyFriction(vel, 4, 100, DT);
    expect(vel.x).toBe(0);
  });

  it('never touches vertical velocity', () => {
    const vel = vec3(200, -123, 0);
    applyFriction(vel, 4, 100, DT);
    expect(vel.y).toBe(-123);
  });
});
