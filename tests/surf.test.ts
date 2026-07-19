// Headless surf tests: build a 50° ramp exactly the way MapBuilder does
// (tilted box brush) and ride it. A working surf implementation keeps the
// player pinned to the face — no friction, never counted as grounded, and
// critically never dead-stopped by repeated same-plane clipping (the classic
// "sticking" failure at overbounce 1.0).

import { describe, expect, it } from 'vitest';
import { vec3 } from '../src/math/vec3';
import { World, brushFromOrientedBox } from '../src/physics/Collision';
import { PlayerController } from '../src/player/PlayerController';
import { DEFAULT_SETTINGS, type Settings } from '../src/settings';

const DT = 1 / 128;

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...structuredClone(DEFAULT_SETTINGS), ...overrides };
}

/**
 * 50° face like MapBuilder.ramp(0, -run, 0, 50, ...), but very wide (x is the
 * ride direction) so tests can ride it for seconds without falling off an end.
 */
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

describe('surfing', () => {
  it('does not freeze at the epsilon fixed point (exact captured state)', () => {
    // Full-precision state captured from a live freeze: resting at exactly
    // DIST_EPSILON off the face with velocity clipped exactly parallel.
    // Float noise in the trace endpoint used to produce femto-fraction
    // phantom hits here, pinning the position while gravity pumped velocity.
    const world = surfWorld();
    const player = new PlayerController(
      world,
      makeSettings(),
      vec3(0, 133.05351157766984, -89.59780135568705),
    );
    player.velocity.y = -236.02081025578147;
    player.velocity.z = -195.42278848836006;

    const startZ = player.origin.z;
    for (let i = 0; i < 64; i++) player.tick(DT);
    // The slide must actually integrate — well over 50 units of travel in
    // half a second at these speeds.
    expect(startZ - player.origin.z).toBeGreaterThan(50);
    const speed = Math.hypot(player.velocity.x, player.velocity.y, player.velocity.z);
    expect(speed).toBeGreaterThan(200);
  });

  it('a straight drop onto the face converts to along-plane slide (no stick)', () => {
    const player = new PlayerController(surfWorld(), makeSettings(), vec3(0, 200, -80));
    player.velocity.y = -200;
    for (let i = 0; i < 128; i++) player.tick(DT);
    expect(player.onGround).toBe(false);
    // Gravity's along-plane component keeps accelerating the slide.
    expect(player.horizontalSpeed).toBeGreaterThan(150);
    expect(player.velocity.y).toBeLessThan(0);
  });

  it('rides the face for seconds while strafing into it, holding speed', () => {
    // Spawn low on the face — strafe-pumping climbs ~20 u/s, and starting
    // high would legitimately summit the test ramp's ridge and stand on it.
    const player = new PlayerController(surfWorld(), makeSettings(), vec3(0, 100, -140));
    // View along +x; strafe-right pushes +z, into the face.
    player.yaw = -90;
    player.input.right = true;
    player.velocity.x = 150;

    let stuckTicks = 0;
    let groundedTicks = 0;
    for (let i = 0; i < 384; i++) {
      // 3 seconds
      player.tick(DT);
      if (i > 30) {
        if (player.horizontalSpeed < 5) stuckTicks++;
        if (player.onGround) groundedTicks++;
      }
    }

    // The regression this guards: duplicate clip planes used to zero the
    // velocity within a few contacts ("surf is cooked").
    expect(stuckTicks).toBe(0);
    expect(groundedTicks).toBe(0);
    // Pure into-face strafe holds position and speed (no friction bleed);
    // along-track gains would come from carving, not from this input.
    expect(player.horizontalSpeed).toBeGreaterThan(140);
    // Still held on the face — not dumped below the foot.
    expect(player.origin.y).toBeGreaterThan(0);
  });

  it('transitions smoothly from the ramp base onto the floor (buried foot)', () => {
    // Map-accurate setup: 50° face with its foot sunk 32u below a floor at
    // y=0, exactly like MapBuilder.ramp(). This guards the phantom-strip
    // regression: an unburied foot leaves hull-expanded collision protruding
    // past the visible base, causing invisible bumps, tunneling, and stops.
    const world = new World();
    const t = (50 * Math.PI) / 180;
    const L = 280;
    const ax = vec3(1, 0, 0);
    const ay = vec3(0, Math.cos(t), -Math.sin(t));
    const az = vec3(0, Math.sin(t), Math.cos(t));
    const foot = vec3(0, -32, -L * Math.cos(t));
    const center = vec3(
      foot.x + az.x * (L / 2) - ay.x * 4,
      foot.y + az.y * (L / 2) - ay.y * 4,
      foot.z + az.z * (L / 2) - ay.z * 4,
    );
    world.solids.push(brushFromOrientedBox(center, vec3(4096, 8, L / 2), ax, ay, az));
    world.solids.push(
      brushFromOrientedBox(vec3(0, -32, 0), vec3(8192, 32, 8192), vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1)),
    );

    // Start high on the face and ride it all the way down and out.
    const player = new PlayerController(world, makeSettings(), vec3(0, 160, -60));
    player.velocity.y = -100;
    let landedTick = -1;
    for (let i = 0; i < 384; i++) {
      player.tick(DT);
      // Never tunnel into the floor or the ramp interior.
      expect(player.origin.y).toBeGreaterThan(-1);
      if (player.onGround && landedTick === -1) {
        landedTick = i;
        // The moment of touchdown: the along-ramp slide carried through the
        // base onto the floor with its horizontal speed intact — no phantom
        // bumper, no dead stop. (Friction takes over afterwards; that's
        // normal ground movement.)
        expect(player.horizontalSpeed).toBeGreaterThan(150);
      }
    }
    expect(landedTick).toBeGreaterThan(30); // spent real time surfing first
    expect(player.onGround).toBe(true);
  });

  it('pumping the strafe against the face never zeroes velocity (aa 800 worst case)', () => {
    const player = new PlayerController(
      surfWorld(),
      makeSettings({ airAccelerate: 800 }),
      vec3(0, 140, -100),
    );
    player.yaw = -90;
    player.input.right = true;
    player.velocity.x = 80;
    for (let i = 0; i < 384; i++) {
      player.tick(DT);
      if (i > 40) {
        expect(player.horizontalSpeed).toBeGreaterThan(5);
      }
    }
  });
});
