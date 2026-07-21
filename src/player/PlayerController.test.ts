// Headless integration tests: run the full PlayerController pipeline against
// a tiny brush world and assert emergent CS:GO behaviors (landing, ground
// speed cap, autobhop air-strafe gain, the vanilla no-pogo rule), plus the
// ramp-base regression that doesn't map to a single behavior folder.

import { describe, expect, it } from 'vitest';
import { vec3 } from '../math/vec3';
import { World } from '../physics/World/World';
import { brushFromAABB, brushFromOrientedBox } from '../physics/Collision/Collision';
import { PlayerController } from './PlayerController';
import { DEFAULT_SETTINGS } from '../settings/Settings';
import type { Settings } from '../settings/Settings';

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

describe('PlayerController', () => {
  it('falls, lands, and comes to rest on the floor', () => {
    const player = new PlayerController(makeWorld(), makeSettings(), vec3(0, 100, 0));
    run(player, 256);
    expect(player.onGround).toBe(true);
    expect(player.origin.y).toBeLessThan(0.1);
    expect(player.horizontalSpeed).toBe(0);
  });

  it('caps ground speed at runSpeed', () => {
    const player = new PlayerController(makeWorld(), makeSettings(), vec3(0, 5, 0));
    player.input.forward = true;
    run(player, 512); // 4 seconds
    expect(player.horizontalSpeed).toBeGreaterThan(245);
    expect(player.horizontalSpeed).toBeLessThanOrEqual(250.001);
  });

  it('walk and crouch use their flat speed values', () => {
    const walker = new PlayerController(makeWorld(), makeSettings(), vec3(0, 5, 0));
    walker.input.forward = true;
    walker.input.walk = true;
    run(walker, 512);
    expect(walker.horizontalSpeed).toBeCloseTo(130, 0);

    const croucher = new PlayerController(makeWorld(), makeSettings(), vec3(0, 5, 0));
    croucher.input.forward = true;
    croucher.input.duck = true;
    run(croucher, 512);
    expect(croucher.ducked).toBe(true);
    expect(croucher.horizontalSpeed).toBeCloseTo(85, 0);
  });

  it('bhop speed clamp holds autobhop cruising speed near 1.1 × maxspeed', () => {
    // noPrestrafe is exercised separately (AirMove.test.ts); disabled here so
    // this test isolates bhopSpeedClamp's own takeoff-clamp + air-strafe
    // interaction, same as before that setting existed.
    const player = new PlayerController(makeWorld(), makeSettings({ noPrestrafe: false }), vec3(0, 5, 0));
    player.input.forward = true;
    run(player, 128);
    player.input.forward = false;
    player.input.right = true;
    player.input.jump = true;
    let peak = 0;
    run(player, 1024, () => {
      player.yaw -= 0.8; // steady air-strafe turn
      peak = Math.max(peak, player.horizontalSpeed);
    });
    // Takeoffs clamp to 275; only modest in-air gain on top of that is
    // possible before the next landing re-clamps.
    expect(peak).toBeGreaterThan(250);
    expect(peak).toBeLessThan(340);
  });

  it('gains speed without bound when the clamp is disabled', () => {
    const player = new PlayerController(
      makeWorld(),
      makeSettings({ bhopSpeedClamp: false, noPrestrafe: false }),
      vec3(0, 5, 0),
    );
    player.input.forward = true;
    run(player, 128);
    player.input.forward = false;
    player.input.right = true;
    player.input.jump = true;
    run(player, 512, () => {
      player.yaw -= 0.8;
    });
    expect(player.horizontalSpeed).toBeGreaterThan(300);
  });

  it('does not pogo when autobhop is off and jump is held', () => {
    const player = new PlayerController(makeWorld(), makeSettings({ autobhop: false }), vec3(0, 5, 0));
    run(player, 64); // settle on the ground
    player.input.jump = true;
    run(player, 128); // first press jumps...
    run(player, 256); // ...but by now we've landed again, still holding jump
    expect(player.onGround).toBe(true);
    expect(player.velocity.y).toBe(0);
  });

  it('jump reaches ~57 units above the floor', () => {
    const player = new PlayerController(makeWorld(), makeSettings(), vec3(0, 5, 0));
    run(player, 64);
    player.input.jump = true;
    let apex = 0;
    run(player, 200, () => {
      apex = Math.max(apex, player.origin.y);
    });
    expect(apex).toBeGreaterThan(55.5);
    expect(apex).toBeLessThan(58);
  });
});

// Ramp-base regression, from a live bug report: standing at (-1680, 10, -783)
// — the base of the west wall-ride — the player froze on the ramp's
// hull-expanded face with velocity climbing (the femto-fraction trace bug).
// With that fixed, the base must behave like authentic Source: at worst a
// brief ungrounded slide off the expanded face, resolving to rest on the
// floor — never a runaway.
describe('ramp base', () => {
  /** West wall-ride: ramp(-1663, 0, 270, 52, 2800, 300), sink 32 — no curb. */
  function westRingWorld(): World {
    const world = new World();
    world.solids.push(brushFromAABB(vec3(-2048, -64, -2048), vec3(2048, 0, 2048))); // ground
    world.solids.push(brushFromAABB(vec3(-2112, 0, -2048), vec3(-2048, 512, 2048))); // wall

    const tilt = (52 * Math.PI) / 180;
    const ax = vec3(0, 0, 1);
    const ay = vec3(Math.sin(tilt), Math.cos(tilt), 0);
    const az = vec3(-Math.cos(tilt), Math.sin(tilt), 0);
    const L = 300;
    const foot = vec3(-1663, -32, 0);
    const center = vec3(
      foot.x + az.x * (L / 2) - ay.x * 8,
      foot.y + az.y * (L / 2) - ay.y * 8,
      foot.z + az.z * (L / 2) - ay.z * 8,
    );
    world.solids.push(brushFromOrientedBox(center, vec3(1400, 8, L / 2), ax, ay, az));
    return world;
  }

  it('resolves the reported phantom-hover spot to grounded control', () => {
    const world = westRingWorld();
    const player = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(-1680, 10, -783));

    let peak = 0;
    for (let i = 0; i < 512; i++) {
      player.tick(DT);
      peak = Math.max(peak, Math.hypot(player.velocity.x, player.velocity.y, player.velocity.z));
    }
    // No runaway: with no input, the player comes to rest on solid ground.
    expect(peak).toBeLessThan(300);
    expect(player.onGround).toBe(true);
    expect(player.horizontalSpeed).toBeLessThan(5);
    expect(world.isPositionFree(player.origin, player.mins, player.maxs)).toBe(true);
  });

  it('pressing into the base surfs the face with bounded speed, then settles', () => {
    const world = westRingWorld();
    const player = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(-1600, 2, -783));
    player.yaw = 90; // face -x, toward the ramp
    player.input.forward = true;

    // Holding into a surf face pins you on it (that's how surfing works) —
    // the invariant is that speed stays bounded, never a runaway.
    for (let i = 0; i < 256; i++) {
      player.tick(DT);
      expect(Math.hypot(player.velocity.x, player.velocity.y, player.velocity.z)).toBeLessThan(500);
    }

    // Release: slide off, land, and come to rest under friction.
    player.input.forward = false;
    for (let i = 0; i < 384; i++) player.tick(DT);
    expect(player.onGround).toBe(true);
    expect(player.horizontalSpeed).toBeLessThan(100);
  });
});
