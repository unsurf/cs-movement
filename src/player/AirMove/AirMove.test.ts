// noPrestrafe ("nopre") deliberately does NOT touch AirMove: air-strafe /
// prestrafe speed gain stays exactly as free as it was before the setting
// existed. The cap lives in WalkMove.ts instead (see WalkMove.test.ts) — this
// file just guards against a future regression that reintroduces an air cap.

import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { World } from '../../physics/World/World';
import { PlayerController } from '../PlayerController';
import { DEFAULT_SETTINGS } from '../../settings/Settings';
import type { Settings } from '../../settings/Settings';

const DT = 1 / 128;

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...structuredClone(DEFAULT_SETTINGS), ...overrides };
}

/** Air-strafe off a ledge with no bhop chain involved: pure prestrafe. */
function prestrafe(settings: Settings): number {
  // Empty world (no floor) — the point is to stay airborne the whole test,
  // isolating air-strafe gain from anything a landing/bhop could add.
  const player = new PlayerController(new World(), settings, vec3(0, 0, 0));
  player.velocity.y = -50;
  player.input.right = true;
  let peak = 0;
  for (let i = 0; i < 384; i++) {
    player.yaw -= 3; // steady air-strafe turn, tuned to actually resonate
    player.tick(DT);
    peak = Math.max(peak, player.horizontalSpeed);
  }
  expect(player.onGround).toBe(false); // sanity: this really tested airborne-only gain
  return peak;
}

describe('noPrestrafe does not affect AirMove', () => {
  it('defaults to enabled', () => {
    expect(DEFAULT_SETTINGS.noPrestrafe).toBe(true);
  });

  it('air-strafe gain is identical whether nopre is on or off', () => {
    const on = prestrafe(makeSettings({ noPrestrafe: true }));
    const off = prestrafe(makeSettings({ noPrestrafe: false }));
    expect(on).toBeGreaterThan(DEFAULT_SETTINGS.runSpeed); // sanity: this really gained speed
    expect(on).toBeCloseTo(off, 6);
  });
});
