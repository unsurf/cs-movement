// Ground duck stays instant (hull + duckFrac both flip/ramp the same as
// before). Airborne duck flips the hull (ducked) instantly — a jump into a
// gap only tall enough for the duck hull needs it right away — but the
// origin.y "head stays put" compensation now ramps with duckFrac over
// DUCK_LERP_TIME instead of shifting the full 18u in one tick. That's what
// makes a duck thrown right before landing buy less extra hang time (and
// less longjump distance) than one thrown early enough to fully complete —
// the real CS:GO "duck at the very end" technique, not a fixed bonus
// regardless of timing. See Duck.ts.

import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { World } from '../../physics/World/World';
import { brushFromAABB } from '../../physics/Collision/Collision';
import { PlayerController } from '../PlayerController';
import { DEFAULT_SETTINGS } from '../../settings/Settings';
import { DUCK_LERP_TIME } from './Duck.config';

const DT = 1 / 128;
const HULL_DELTA = 18; // HULL_STAND_HEIGHT - HULL_DUCK_HEIGHT

function makeFloorWorld(): World {
  const world = new World();
  world.solids.push(brushFromAABB(vec3(-4000, -64, -4000), vec3(4000, 0, 4000)));
  return world;
}

describe('ground duck', () => {
  it('flips ducked instantly but still ramps duckFrac over DUCK_LERP_TIME', () => {
    const player = new PlayerController(makeFloorWorld(), structuredClone(DEFAULT_SETTINGS), vec3(0, 5, 0));
    for (let i = 0; i < 10; i++) player.tick(DT); // settle on the floor

    player.input.duck = true;
    player.tick(DT);
    expect(player.ducked).toBe(true);
    expect(player.duckFrac).toBeGreaterThan(0);
    expect(player.duckFrac).toBeLessThan(1);

    for (let i = 0; i < Math.ceil(DUCK_LERP_TIME / DT) + 2; i++) player.tick(DT);
    expect(player.duckFrac).toBeCloseTo(1, 5);
  });
});

describe('airborne duck', () => {
  it('flips the hull (ducked) instantly but ramps duckFrac gradually', () => {
    const player = new PlayerController(new World(), structuredClone(DEFAULT_SETTINGS), vec3(0, 500, 0));
    player.tick(DT);
    expect(player.onGround).toBe(false);

    player.input.duck = true;
    player.tick(DT);

    expect(player.ducked).toBe(true); // hull collision: instant
    expect(player.duckFrac).toBeGreaterThan(0);
    expect(player.duckFrac).toBeLessThan(1); // origin/eye compensation: gradual
  });

  it("origin.y rise matches duckFrac's progress scaled by the hull delta, not a one-tick jump", () => {
    const settings = structuredClone(DEFAULT_SETTINGS);
    const control = new PlayerController(new World(), settings, vec3(0, 500, 0));
    const ducked = new PlayerController(new World(), settings, vec3(0, 500, 0));
    control.tick(DT);
    ducked.tick(DT);
    ducked.input.duck = true;

    for (let i = 0; i < 20; i++) {
      control.tick(DT);
      ducked.tick(DT);
      const originRise = ducked.origin.y - control.origin.y;
      expect(originRise).toBeCloseTo(ducked.duckFrac * HULL_DELTA, 5);
    }
    // Sanity: this test actually caught the transition in progress at some
    // point, not just before/after it — otherwise the assertion above is
    // vacuously true at 0 and at duckFrac===1.
    expect(ducked.duckFrac).toBeGreaterThan(0);
    expect(ducked.duckFrac).toBeLessThan(1);
  });

  it('a duck held from well before landing completes fully; one thrown right at the end only partially completes', () => {
    function longjumpDistance(duckLeadTicks: number): number {
      const settings = structuredClone(DEFAULT_SETTINGS);
      const player = new PlayerController(makeFloorWorld(), settings, vec3(0, 0, 0));
      for (let i = 0; i < 5; i++) player.tick(DT);
      for (let i = 0; i < 200; i++) {
        player.input.forward = true;
        player.tick(DT);
      }
      const takeoffX = player.origin.x;
      const takeoffZ = player.origin.z;
      player.input.jump = true;
      player.tick(DT);
      player.input.jump = false;

      let ticksAirborne = 0;
      const duckTick = duckLeadTicks; // ticks after takeoff to start ducking
      while (!player.onGround && ticksAirborne < 300) {
        ticksAirborne++;
        if (ticksAirborne >= duckTick) player.input.duck = true;
        player.tick(DT);
      }
      // yaw is 0 (forward = -z) by default — measure both axes so this
      // doesn't silently break if that default ever changes.
      const dx = player.origin.x - takeoffX;
      const dz = player.origin.z - takeoffZ;
      return Math.hypot(dx, dz);
    }

    const noDuck = longjumpDistance(Infinity);
    const duckEarly = longjumpDistance(1); // ducks almost immediately after takeoff
    const duckLate = longjumpDistance(90); // ducks only a handful of ticks before landing

    expect(duckEarly).toBeGreaterThan(noDuck);
    expect(duckLate).toBeGreaterThan(noDuck);
    // The whole point of the gradual ramp: an early duck completes fully and
    // gains more distance than a late one that gets cut off by landing.
    expect(duckEarly).toBeGreaterThan(duckLate);
  });
});
