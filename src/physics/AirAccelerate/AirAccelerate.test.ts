import { describe, expect, it } from 'vitest';
import { vec3, length } from '../../math/vec3';
import { airAccelerate } from './AirAccelerate';

const DT = 1 / 128;

describe('airAccelerate', () => {
  it('gains speed strafing perpendicular to velocity', () => {
    const vel = vec3(300, 0, 0);
    airAccelerate(vel, vec3(0, 0, 1), 250, 800, DT);
    // addspeed capped at 30; accelspeed (800*250/128 = 1562.5) exceeds it.
    expect(vel.z).toBeCloseTo(30, 6);
    expect(length(vel)).toBeGreaterThan(300);
  });

  it('adds nothing straight ahead beyond the 30 u/s cap', () => {
    const vel = vec3(300, 0, 0);
    airAccelerate(vel, vec3(1, 0, 0), 250, 800, DT);
    expect(vel.x).toBe(300);
  });

  it('uses UNCAPPED wishspeed in the accelspeed term (Source asymmetry)', () => {
    const vel = vec3();
    airAccelerate(vel, vec3(1, 0, 0), 250, 12, DT);
    // accelspeed = 12 * 250 / 128 = 23.4375 < addspeed 30 — with the capped
    // wishspeed it would be 12 * 30 / 128 = 2.8125 instead.
    expect(vel.x).toBeCloseTo(23.4375, 4);
  });
});
