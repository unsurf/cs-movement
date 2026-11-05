import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { brushFromAABB } from '../../physics/Collision/Collision';
import { World } from '../../physics/World/World';
import { DEFAULT_SETTINGS } from '../../settings/Settings';
import { PlayerController } from '../PlayerController';
import { AIR_DUCK_ORIGIN_SHIFT } from './Duck.config';
import { updateDuck } from './Duck';
import { DUCK_IN_SPEED_FACTOR, DUCK_SPEED_IDEAL, TIME_BETWEEN_DUCKS } from './Duck.config';
import { currentMaxSpeed } from '../CurrentMaxSpeed/CurrentMaxSpeed';

const DT = 1 / 128;

// CCSGameMovement::FinishDuck/FinishUnDuck: on the ground the stand and duck
// hull mins are identical so nothing moves; in the air the feet move by half
// the hull-height difference (9u), up when ducking and back down when standing.

function airbornePlayer(world = new World()): PlayerController {
  return new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 500, 0));
}

describe('airborne duck origin shift', () => {
  it('is 9 units (half of 72 - 54)', () => {
    expect(AIR_DUCK_ORIGIN_SHIFT).toBe(9);
  });

  it('ducking in the air raises the feet by 9; standing again drops them by 9', () => {
    const p = airbornePlayer();
    p.input.duck = true;
    updateDuck(p, DT);
    expect(p.ducked).toBe(true);
    expect(p.origin.y).toBe(509);

    p.input.duck = false;
    updateDuck(p, DT);
    expect(p.ducked).toBe(false);
    expect(p.origin.y).toBe(500);
  });

  it('does not move the origin when ducking or standing on the ground', () => {
    const world = new World();
    world.solids.push(brushFromAABB(vec3(-512, -16, -512), vec3(512, 0, 512)));
    const p = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 0.03125, 0));
    p.onGround = true;
    p.input.duck = true;
    for (let i = 0; i < 40; i++) updateDuck(p, DT);
    expect(p.ducked).toBe(true);
    expect(p.origin.y).toBe(0.03125);
    p.input.duck = false;
    for (let i = 0; i < 40; i++) updateDuck(p, DT);
    expect(p.ducked).toBe(false);
    expect(p.origin.y).toBe(0.03125);
  });

  it('refuses to stand in the air when the standing hull cannot sweep down 9u', () => {
    const world = new World();
    // Ceiling-free, but a floor 5u under the ducked feet blocks the standing hull's 9u drop.
    world.solids.push(brushFromAABB(vec3(-512, 490, -512), vec3(512, 504, 512)));
    const p = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 505, 0));
    p.ducked = true;
    p.duckFrac = 1;
    p.duckFlag = true;
    p.input.duck = false;
    updateDuck(p, DT);
    expect(p.ducked).toBe(true);
    expect(p.origin.y).toBe(505);
  });

  it('refuses to stand on the ground under a low ceiling', () => {
    const world = new World();
    world.solids.push(brushFromAABB(vec3(-512, -16, -512), vec3(512, 0, 512)));
    world.solids.push(brushFromAABB(vec3(-512, 60, -512), vec3(512, 80, 512)));
    const p = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 0.03125, 0));
    p.onGround = true;
    p.ducked = true;
    p.duckFrac = 1;
    p.duckFlag = true;
    p.input.duck = false;
    updateDuck(p, DT);
    expect(p.ducked).toBe(true);
  });
});

function groundPlayer(): PlayerController {
  const world = new World();
  world.solids.push(brushFromAABB(vec3(-512, -16, -512), vec3(512, 0, 512)));
  const p = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 0.03125, 0));
  p.onGround = true;
  return p;
}

describe('timed ground duck (CCSGameMovement::Duck)', () => {
  it('ramps the duck amount at duckSpeed * 0.8 per second and switches hull on arrival', () => {
    const p = groundPlayer();
    p.input.duck = true;
    updateDuck(p, DT);
    // The key press costs 2 duck speed (CheckParameters), then Duck() recovers 3/s of it.
    expect(p.duckFrac).toBeCloseTo((DUCK_SPEED_IDEAL - 2 + 3 * DT) * DUCK_IN_SPEED_FACTOR * DT, 6);
    expect(p.ducked).toBe(false); // hull stays standing mid-transition

    let ticks = 1;
    while (!p.ducked && ticks < 400) {
      updateDuck(p, DT);
      ticks++;
    }
    expect(p.ducked).toBe(true);
    expect(p.duckFrac).toBe(1);
    expect(ticks).toBeGreaterThan(20); // not instant
  });

  it('eases the max-speed crop in with the duck amount', () => {
    const p = groundPlayer();
    p.duckHeld = true;
    p.ducking = true;
    p.duckFrac = 0.5;
    const full = DEFAULT_SETTINGS.crouchSpeed / DEFAULT_SETTINGS.runSpeed;
    expect(currentMaxSpeed(p)).toBeCloseTo(DEFAULT_SETTINGS.runSpeed * (full * 0.5 + 0.5), 6);
    p.duckFrac = 1;
    p.ducked = true;
    expect(currentMaxSpeed(p)).toBeCloseTo(DEFAULT_SETTINGS.crouchSpeed, 6);
  });

  it('ignores the duck key once mashing has spent the duck speed', () => {
    const p = groundPlayer();
    // Every raw press/release costs 2 of the 8 duck speed.
    for (let i = 0; i < 6; i++) {
      p.input.duck = !p.input.duck;
      updateDuck(p, DT);
    }
    expect(p.duckSpeed).toBeLessThan(1.5);
    p.input.duck = true;
    updateDuck(p, DT);
    expect(p.duckHeld).toBe(false);
  });

  it(`refuses to start a duck within ${TIME_BETWEEN_DUCKS}s of the last finished one`, () => {
    const p = groundPlayer();
    p.lastDuckTime = p.time;
    p.input.duck = true;
    updateDuck(p, DT);
    expect(p.duckHeld).toBe(false);
    p.time += TIME_BETWEEN_DUCKS;
    updateDuck(p, DT);
    expect(p.duckHeld).toBe(true);
  });
});

