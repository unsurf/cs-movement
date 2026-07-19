// Ramp-base regression, from a live bug report: standing at (-1680, 10, -783)
// — the base of the west wall-ride — the player froze on the ramp's
// hull-expanded face with velocity climbing (the femto-fraction trace bug).
// With that fixed, the base must behave like authentic Source: at worst a
// brief ungrounded slide off the expanded face, resolving to rest on the
// floor — never a runaway.

import { describe, expect, it } from 'vitest';
import { vec3 } from '../src/math/vec3';
import { World, brushFromAABB, brushFromOrientedBox } from '../src/physics/Collision';
import { PlayerController } from '../src/player/PlayerController';
import { DEFAULT_SETTINGS } from '../src/settings';

const DT = 1 / 128;

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

describe('ramp base', () => {
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
