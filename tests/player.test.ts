// Headless integration tests: run the full PlayerController pipeline against
// a tiny brush world and assert emergent CS:GO behaviors (landing, ground
// speed cap, autobhop air-strafe gain, the vanilla no-pogo rule).

import { describe, expect, it } from 'vitest';
import { vec3 } from '../src/math/vec3';
import { World, brushFromAABB } from '../src/physics/Collision';
import { PlayerController } from '../src/player/PlayerController';
import { DEFAULT_SETTINGS, type Settings } from '../src/settings';

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

  it('nopre clamp holds autobhop cruising speed near 1.1 × maxspeed', () => {
    const player = new PlayerController(makeWorld(), makeSettings(), vec3(0, 5, 0));
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
      makeSettings({ bhopSpeedClamp: false }),
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
