import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { accelerate } from './Accelerate';

const DT = 1 / 128;

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
