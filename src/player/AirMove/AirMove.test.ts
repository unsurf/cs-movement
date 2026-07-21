// noPrestrafe ("nopre"): angled air-strafing must not push speed past the
// player's current ground max speed — but it must never claw back speed
// the player already has from elsewhere (an uncapped bhop chain, a
// perf-bonus takeoff), or it would silently defeat those other toggles.

import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { World } from '../../physics/World/World';
import { brushFromAABB, brushFromOrientedBox } from '../../physics/Collision/Collision';
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

function run(player: PlayerController, ticks: number, perTick?: () => void): void {
  for (let i = 0; i < ticks; i++) {
    perTick?.();
    player.tick(DT);
  }
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

describe('noPrestrafe', () => {
  it('defaults to enabled', () => {
    expect(DEFAULT_SETTINGS.noPrestrafe).toBe(true);
  });

  it('caps air-strafe gain at run speed; off, the same input gains more', () => {
    const capped = prestrafe(makeSettings({ noPrestrafe: true }));
    const uncapped = prestrafe(makeSettings({ noPrestrafe: false }));
    expect(capped).toBeLessThanOrEqual(DEFAULT_SETTINGS.runSpeed + 0.01);
    expect(uncapped).toBeGreaterThan(capped);
  });

  it('does not claw back speed already gained from an uncapped bhop chain', () => {
    // Build speed well past runSpeed the same way the bhopSpeedClamp:false
    // test does, with noPrestrafe off so the chain isn't capped mid-build.
    const settings = makeSettings({ bhopSpeedClamp: false, noPrestrafe: false });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0));
    player.input.forward = true;
    run(player, 128);
    player.input.forward = false;
    player.input.right = true;
    player.input.jump = true;
    run(player, 512, () => {
      player.yaw -= 0.8;
    });
    const boosted = player.horizontalSpeed;
    expect(boosted).toBeGreaterThan(DEFAULT_SETTINGS.runSpeed);

    // Now flip noPrestrafe on mid-flight and confirm the existing speed
    // survives being airborne — it must only block NEW gains, not strip
    // what's already there.
    player.settings.noPrestrafe = true;
    run(player, 32);
    expect(player.horizontalSpeed).toBeGreaterThan(boosted - 5);
  });

  it('exempts surfing — the cap makes no difference while riding a ramp', () => {
    // Same 50° surf setup as TryPlayerMove.test.ts's "rides the face for
    // seconds" case. Run it once with noPrestrafe on and once off; if the
    // exemption works, ctx.surfing keeps the cap from ever engaging, so both
    // runs should land at essentially the same speed.
    function surfWorld(): World {
      const world = new World();
      const t = (50 * Math.PI) / 180;
      const L = 280;
      const ax = vec3(1, 0, 0);
      const ay = vec3(0, Math.cos(t), -Math.sin(t));
      const az = vec3(0, Math.sin(t), Math.cos(t));
      const foot = vec3(0, 0, -L * Math.cos(t));
      const center = vec3(
        foot.x + az.x * (L / 2) - ay.x * 4,
        foot.y + az.y * (L / 2) - ay.y * 4,
        foot.z + az.z * (L / 2) - ay.z * 4,
      );
      world.solids.push(brushFromOrientedBox(center, vec3(8192, 8, L / 2), ax, ay, az));
      return world;
    }

    function surf(noPrestrafe: boolean): number {
      const player = new PlayerController(surfWorld(), makeSettings({ noPrestrafe }), vec3(0, 100, -140));
      player.yaw = -90;
      player.input.right = true;
      player.velocity.x = 150;
      run(player, 200);
      expect(player.surfing).toBe(true); // sanity: this really tested the surfing path
      return player.horizontalSpeed;
    }

    expect(surf(true)).toBeCloseTo(surf(false), 0);
  });
});
