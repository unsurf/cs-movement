// Real Source's SetDuckedEyeOffset only ever writes the view/camera offset,
// never the player's origin — and the default hull mins are identical
// standing vs ducked, so ducking only lowers the hull's ceiling (maxs), not
// its feet. That means ducking cannot change ground-collision timing in
// real Source; a longjump's flight path is unaffected by duck on its own.
//
// CS:GO nonetheless measurably gives a duck-held longjump extra distance in
// real play, and that mechanism lives in CS:GO's closed-source game
// movement, not the public SDK. DUCK_LANDING_BONUS (Duck.config.ts) is a
// labeled approximation of it, not a reverse-engineered mechanic — applied
// once per flight, timing-invariant, regardless of when duck engages.

import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { World } from '../../physics/World/World';
import { brushFromAABB } from '../../physics/Collision/Collision';
import { PlayerController } from '../PlayerController';
import { DEFAULT_SETTINGS } from '../../settings/Settings';
import { DUCK_LANDING_BONUS } from './Duck.config';

const DT = 1 / 128;

function makeFloorWorld(): World {
  const world = new World();
  world.solids.push(brushFromAABB(vec3(-4000, -64, -4000), vec3(4000, 0, 4000)));
  return world;
}

/** duckLeadTicks: ticks after takeoff before duck engages. 0 = same tick as jump. Infinity = never. */
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
  if (duckLeadTicks === 0) player.input.duck = true;
  player.tick(DT);
  player.input.jump = false;

  let ticksAirborne = 0;
  while (!player.onGround && ticksAirborne < 300) {
    ticksAirborne++;
    if (duckLeadTicks > 0 && ticksAirborne >= duckLeadTicks) player.input.duck = true;
    player.tick(DT);
  }
  const dx = player.origin.x - takeoffX;
  const dz = player.origin.z - takeoffZ;
  return Math.hypot(dx, dz);
}

describe('airborne duck (no bonus)', () => {
  it('does not move the origin — only the hull maxs (top) and ducked flag change', () => {
    const settings = structuredClone(DEFAULT_SETTINGS);
    const airborne = new PlayerController(new World(), settings, vec3(0, 500, 0));
    const control = new PlayerController(new World(), settings, vec3(0, 500, 0));
    airborne.tick(DT);
    control.tick(DT);
    expect(airborne.onGround).toBe(false);

    airborne.input.duck = true;
    airborne.tick(DT); // this tick is a straight-up drop: no horizontal speed, no bonus to apply
    control.tick(DT); // identical fall, no duck

    expect(airborne.ducked).toBe(true);
    expect(airborne.origin.y).toBeCloseTo(control.origin.y, 6);
    expect(airborne.origin.x).toBeCloseTo(control.origin.x, 6);
    expect(airborne.origin.z).toBeCloseTo(control.origin.z, 6);
  });
});

describe('DUCK_LANDING_BONUS (labeled approximation, see Duck.config.ts)', () => {
  it('gives the identical longjump distance whether duck engages same-tick as jump, right after, mid-air, or late', () => {
    const sameTick = longjumpDistance(0);
    const rightAfter = longjumpDistance(1);
    const midAir = longjumpDistance(40);
    const late = longjumpDistance(90); // a handful of ticks before natural landing

    expect(rightAfter).toBeCloseTo(sameTick, 1);
    expect(midAir).toBeCloseTo(sameTick, 1);
    expect(late).toBeCloseTo(sameTick, 1);
  });

  it('adds exactly DUCK_LANDING_BONUS units over a no-duck jump', () => {
    const noDuck = longjumpDistance(Infinity);
    const ducked = longjumpDistance(0);
    expect(ducked - noDuck).toBeCloseTo(DUCK_LANDING_BONUS, 1);
  });
});
