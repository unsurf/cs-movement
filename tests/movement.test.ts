import { describe, expect, it } from 'vitest';
import { GRAVITY, JUMP_VELOCITY } from '../src/constants';
import { vec3, length } from '../src/math/vec3';
import { accelerate, airAccelerate, applyFriction, clipVelocity } from '../src/physics/MovementPhysics';

const DT = 1 / 128;
const S = Math.SQRT1_2;

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

describe('accelerate', () => {
  it('adds accel * dt * wishspeed from rest', () => {
    const vel = vec3();
    accelerate(vel, vec3(1, 0, 0), 250, 10, DT);
    expect(vel.x).toBeCloseTo(19.53125, 4);
  });

  it('adds nothing at wishspeed (ground cap emerges from the formula)', () => {
    const vel = vec3(250, 0, 0);
    accelerate(vel, vec3(1, 0, 0), 250, 10, DT);
    expect(vel.x).toBe(250);
  });
});

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

describe('clipVelocity', () => {
  it('removes exactly the into-plane component at overbounce 1.0', () => {
    const vel = vec3(100, -300, 0);
    clipVelocity(vel, vec3(0, 1, 0), 1.0);
    expect(vel.x).toBe(100);
    expect(vel.y).toBe(0);
  });

  it('pushes slightly out of the plane at overbounce 1.001', () => {
    const vel = vec3(0, -300, 0);
    clipVelocity(vel, vec3(0, 1, 0), 1.001);
    expect(vel.y).toBeCloseTo(0.3, 6);
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

describe('jump + gravity integration', () => {
  it('reaches ~57 units with half-gravity applied around the move', () => {
    let y = 0;
    let v = JUMP_VELOCITY;
    let maxY = 0;
    for (let i = 0; i < 256; i++) {
      v -= 0.5 * GRAVITY * DT;
      y += v * DT;
      v -= 0.5 * GRAVITY * DT;
      if (y > maxY) maxY = y;
    }
    expect(maxY).toBeGreaterThan(56);
    expect(maxY).toBeLessThan(57.5);
  });
});
