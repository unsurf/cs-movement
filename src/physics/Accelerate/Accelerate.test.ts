import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { accelerate } from './Accelerate';
import type { AccelerateModifiers } from './Accelerate.types';

const DT = 1 / 128;
const MODS: AccelerateModifiers = {
  ducking: false,
  walking: false,
  duckModifier: 0.34,
  walkModifier: 0.52,
  weaponFactor: 1,
  slowSniperScoped: false,
};

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

  it('scales by max(250, wishspeed) times the duck/walk factor, not by wishspeed alone', () => {
    // Crouch: wishspeed 85, factor 0.34 -> scale 250 * 0.34 = 85.
    const crouch = vec3();
    accelerate(crouch, vec3(1, 0, 0), 85, 5.5, DT, { ...MODS, ducking: true });
    expect(crouch.x).toBeCloseTo(5.5 * 85 / 128, 4);

    // Walk key held while still fast: wishspeed stays 250 but the scale is 250 * 0.52.
    const fastWalk = vec3(100, 0, 0);
    accelerate(fastWalk, vec3(1, 0, 0), 250, 5.5, DT, { ...MODS, walking: true });
    expect(fastWalk.x - 100).toBeCloseTo(5.5 * 130 / 128, 4);
  });

  it('fades walk acceleration to zero just below the walk goal speed', () => {
    const mods = { ...MODS, walking: true };
    const nearGoal = vec3(127.5, 0, 0); // halfway through the 5 u/s fade
    accelerate(nearGoal, vec3(1, 0, 0), 130, 100, DT, mods);
    // accel halves (100 -> 50): 50 * 130 / 128 = 50.78 -> capped by addspeed 2.5
    expect(nearGoal.x).toBeCloseTo(130, 4);

    const slow = vec3(100, 0, 0);
    accelerate(slow, vec3(1, 0, 0), 130, 5.5, DT, mods); // below the fade zone: untouched
    expect(slow.x - 100).toBeCloseTo(5.5 * 130 / 128, 4);
  });

  it('scales acceleration by the weapon speed factor (AWP-style 200 u/s)', () => {
    const awp = vec3();
    accelerate(awp, vec3(1, 0, 0), 200, 5.5, DT, { ...MODS, weaponFactor: 0.8 });
    expect(awp.x).toBeCloseTo((5.5 * 250 * 0.8) / 128, 4);
  });

  it('weapon factor does not stack with walk/duck unless slow-sniper-scoped', () => {
    const walking = vec3(50, 0, 0);
    accelerate(walking, vec3(1, 0, 0), 250, 5.5, DT, { ...MODS, walking: true, weaponFactor: 0.8 });
    expect(walking.x - 50).toBeCloseTo((5.5 * 250 * 0.52) / 128, 4); // weapon skipped

    const scoped = vec3(0, 0, 0);
    accelerate(scoped, vec3(1, 0, 0), 250, 5.5, DT, {
      ...MODS,
      ducking: true,
      weaponFactor: 0.4,
      slowSniperScoped: true,
    });
    expect(scoped.x).toBeCloseTo((5.5 * 250 * 0.4) / 128, 4); // weapon applied, duck factor skipped
  });
});
