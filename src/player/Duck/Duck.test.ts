import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { brushFromAABB } from '../../physics/Collision/Collision';
import { World } from '../../physics/World/World';
import { DEFAULT_SETTINGS } from '../../settings/Settings';
import { PlayerController } from '../PlayerController';
import { AIR_DUCK_ORIGIN_SHIFT } from './Duck.config';
import { updateDuck } from './Duck';

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
    updateDuck(p);
    expect(p.ducked).toBe(true);
    expect(p.origin.y).toBe(509);

    p.input.duck = false;
    updateDuck(p);
    expect(p.ducked).toBe(false);
    expect(p.origin.y).toBe(500);
  });

  it('does not move the origin when ducking or standing on the ground', () => {
    const world = new World();
    world.solids.push(brushFromAABB(vec3(-512, -16, -512), vec3(512, 0, 512)));
    const p = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 0.03125, 0));
    p.onGround = true;
    p.input.duck = true;
    updateDuck(p);
    expect(p.ducked).toBe(true);
    expect(p.origin.y).toBe(0.03125);
    p.input.duck = false;
    updateDuck(p);
    expect(p.ducked).toBe(false);
    expect(p.origin.y).toBe(0.03125);
  });

  it('refuses to stand in the air when the standing hull cannot sweep down 9u', () => {
    const world = new World();
    // Ceiling-free, but a floor 5u under the ducked feet blocks the standing hull's 9u drop.
    world.solids.push(brushFromAABB(vec3(-512, 490, -512), vec3(512, 504, 512)));
    const p = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 505, 0));
    p.ducked = true;
    p.input.duck = false;
    updateDuck(p);
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
    p.input.duck = false;
    updateDuck(p);
    expect(p.ducked).toBe(true);
  });
});
