// CheckStuck regression: getting wedged inside overlapping brushes (e.g. the
// seam where two Λ ramp faces cross) must resolve by nudging the player out —
// never by pinning them in place while gravity pumps their velocity to
// infinity, and never by letting velocity grow without the position moving.

import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { World } from '../../physics/World/World';
import { brushFromAABB, brushFromOrientedBox } from '../../physics/Collision/Collision';
import { PlayerController } from '../PlayerController';
import { DEFAULT_SETTINGS } from '../../settings/Settings';
import type { Settings } from '../../settings/Settings';

const DT = 1 / 128;

function makeSettings(): Settings {
  return structuredClone(DEFAULT_SETTINGS);
}

function lambdaRampWorld(): World {
  // Two 50° faces crossing at a ridge (like the courtyard spine), on a floor.
  const world = new World();
  const t = (50 * Math.PI) / 180;
  const L = 280;
  const run = L * Math.cos(t);
  for (const sign of [1, -1]) {
    const ay = vec3(0, Math.cos(t), sign * -Math.sin(t));
    const az = vec3(0, sign * Math.sin(t), sign * Math.cos(t));
    const foot = vec3(0, -32, sign * -run);
    const center = vec3(
      foot.x + az.x * (L / 2) - ay.x * 4,
      foot.y + az.y * (L / 2) - ay.y * 4,
      foot.z + az.z * (L / 2) - ay.z * 4,
    );
    world.solids.push(brushFromOrientedBox(center, vec3(500, 8, L / 2), vec3(1, 0, 0), ay, az));
  }
  world.solids.push(brushFromAABB(vec3(-4096, -64, -4096), vec3(4096, 0, 4096)));
  return world;
}

describe('checkStuck', () => {
  it('nudges an embedded player back to free space', () => {
    const world = lambdaRampWorld();
    // Start embedded a few units inside a ramp face near the ridge.
    const player = new PlayerController(world, makeSettings(), vec3(0, 140, -30));
    player.tick(DT);
    // One tick is enough: the nudge itself frees the hull and adds no speed.
    expect(world.isPositionFree(player.origin, player.mins, player.maxs)).toBe(true);
    expect(player.horizontalSpeed).toBeLessThan(30);
    // From there normal surf physics takes over without exploding.
    for (let i = 0; i < 64; i++) player.tick(DT);
    expect(world.isPositionFree(player.origin, player.mins, player.maxs)).toBe(true);
    expect(player.horizontalSpeed).toBeLessThan(600);
  });

  it('a fully trapped mover ends becalmed, never accumulating velocity', () => {
    // Sealed pocket: a V-groove of two 52° faces (never walkable ground)
    // boxed in by four walls. Whatever combination of clips, creases, and
    // blocked bumps occurs in here, the invariant is: speed must collapse
    // and stay collapsed — the frozen-position/growing-velocity state from
    // the live bug reports must be impossible.
    const world = new World();
    const t = (52 * Math.PI) / 180;
    const s = Math.sin(t);
    const c = Math.cos(t);
    const L = 260;
    // Right face of the V: climbs toward +x, normal leans up-left.
    // Left face mirrors it. Their low edges meet near x=0, y=-40.
    for (const sign of [1, -1]) {
      const ay = vec3(-sign * s, c, 0);
      const az = vec3(sign * c, s, 0);
      // Feet crossed (right face's foot on the left and vice versa) so the
      // faces overlap and the valley floor is sealed under the hull.
      const foot = vec3(-sign * 20, -40, 0);
      const center = vec3(
        foot.x + az.x * (L / 2) - ay.x * 8,
        foot.y + az.y * (L / 2) - ay.y * 8,
        foot.z + az.z * (L / 2) - ay.z * 8,
      );
      world.solids.push(brushFromOrientedBox(center, vec3(200, 8, L / 2), vec3(0, 0, 1), ay, az));
    }
    world.solids.push(brushFromAABB(vec3(-300, -100, -220), vec3(300, 400, -180))); // z- wall
    world.solids.push(brushFromAABB(vec3(-300, -100, 180), vec3(300, 400, 220))); // z+ wall
    world.solids.push(brushFromAABB(vec3(-320, -100, -220), vec3(-280, 400, 220))); // x- wall
    world.solids.push(brushFromAABB(vec3(280, -100, -220), vec3(320, 400, 220))); // x+ wall

    const player = new PlayerController(world, makeSettings(), vec3(0, 120, 0));
    player.velocity.x = 1000;
    player.velocity.y = -1200;
    player.velocity.z = -800;

    let peakLate = 0;
    for (let i = 0; i < 512; i++) {
      player.tick(DT);
      if (i > 128) {
        peakLate = Math.max(peakLate, Math.hypot(player.velocity.x, player.velocity.y, player.velocity.z));
      }
    }
    expect(peakLate).toBeLessThan(150);
  });

  it('never pumps velocity while the position is not moving', () => {
    const world = lambdaRampWorld();
    // Drop onto the ridge seam where the two faces overlap.
    const player = new PlayerController(world, makeSettings(), vec3(0, 260, 0));
    player.velocity.y = -150;

    let prev = vec3(0, 0, 0);
    for (let i = 0; i < 512; i++) {
      prev = { ...player.origin };
      player.tick(DT);
      const moved = Math.hypot(
        player.origin.x - prev.x,
        player.origin.y - prev.y,
        player.origin.z - prev.z,
      );
      const speed = Math.hypot(player.velocity.x, player.velocity.y, player.velocity.z);
      // The runaway bug looked like: origin frozen, speed climbing. If we
      // have real speed, the position must actually be moving.
      if (speed > 400) {
        expect(moved).toBeGreaterThan((speed * DT) / 4);
      }
      expect(speed).toBeLessThan(2000);
    }
  });
});
