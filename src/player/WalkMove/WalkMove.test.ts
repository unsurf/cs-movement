// noPrestrafe regression: accelerate()'s addspeed check compares against
// dot(vel, wishdir) rather than |vel|, so continuously turning wishdir while
// holding a strafe key lets GROUND movement gain speed past maxspeed too —
// the same mechanism as air-strafing, just via walkMove/accelerate() instead
// of airMove/airAccelerate(). Friction alone doesn't fully suppress it at
// this codebase's tuning, so noPrestrafe has to cap ground movement as well,
// not just AirMove.

import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { World } from '../../physics/World/World';
import { brushFromAABB } from '../../physics/Collision/Collision';
import { PlayerController } from '../PlayerController';
import { DEFAULT_SETTINGS } from '../../settings/Settings';
import type { Settings } from '../../settings/Settings';

const DT = 1 / 128;

function makeWorld(): World {
  const world = new World();
  world.solids.push(brushFromAABB(vec3(-8192, -64, -8192), vec3(8192, 0, 8192)));
  return world;
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...structuredClone(DEFAULT_SETTINGS), ...overrides };
}

/** Never leaves the ground: forward+strafe held, continuously turning yaw. */
function groundTurnPeak(settings: Settings, turnRate: number): number {
  const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0));
  player.input.forward = true;
  player.input.right = true;
  let peak = 0;
  for (let i = 0; i < 1024; i++) {
    player.yaw -= turnRate;
    player.tick(DT);
    peak = Math.max(peak, player.horizontalSpeed);
  }
  return peak;
}

describe('noPrestrafe on the ground', () => {
  it('off: continuous ground-turn strafing can exceed run speed', () => {
    const peak = groundTurnPeak(makeSettings({ noPrestrafe: false }), 2);
    expect(peak).toBeGreaterThan(DEFAULT_SETTINGS.runSpeed * 1.2);
  });

  it('on: the same ground-turn strafing never exceeds run speed', () => {
    for (const turnRate of [0.5, 0.8, 1.5, 2, 3, 5]) {
      const peak = groundTurnPeak(makeSettings({ noPrestrafe: true }), turnRate);
      expect(peak).toBeLessThanOrEqual(DEFAULT_SETTINGS.runSpeed + 0.01);
    }
  });

  it('caps landing speed to ground max, but air-strafe gain to get there is untouched', () => {
    // Build genuine airborne speed via prestrafe (AirMove is never capped),
    // then land on flat ground and confirm walkMove brings it straight down
    // to run speed instead of preserving it as a permanent ground sprint.
    const settings = makeSettings({ noPrestrafe: true });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 3000, 0));
    player.input.right = true;
    let peakAirborne = 0;
    for (let i = 0; i < 512 && !player.onGround; i++) {
      player.yaw -= 3;
      player.tick(DT);
      peakAirborne = Math.max(peakAirborne, player.horizontalSpeed);
    }
    expect(peakAirborne).toBeGreaterThan(DEFAULT_SETTINGS.runSpeed * 1.5); // real prestrafe gain happened
    expect(player.onGround).toBe(true);
    // categorizePosition only flips onGround at the END of the landing
    // tick — walkMove doesn't run on that tick, so give it a couple more
    // to actually execute and apply the cap.
    player.tick(DT);
    player.tick(DT);
    expect(player.horizontalSpeed).toBeLessThanOrEqual(DEFAULT_SETTINGS.runSpeed + 0.01);
  });
});
