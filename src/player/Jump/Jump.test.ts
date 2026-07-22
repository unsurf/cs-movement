import { describe, expect, it } from 'vitest';
import { GRAVITY } from '../../constants';
import { JUMP_VELOCITY } from './Jump.config';

const DT = 1 / 128;

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

// bhopSpeedClamp coverage (the only speed limit checkJump applies) lives in
// PlayerController.test.ts — it needs a full autobhop+air-strafe simulation
// to exercise properly, which that file already sets up.
