import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { brushFromAABB, createTraceResult } from '../../physics/Collision/Collision';
import { World } from '../../physics/World/World';
import { DEFAULT_SETTINGS } from '../../settings/Settings';
import { PlayerController } from '../PlayerController';
import { categorizePosition } from './CategorizePosition';
import { NON_JUMP_VELOCITY } from './CategorizePosition.config';

function standingPlayer(): PlayerController {
  const world = new World();
  world.solids.push(brushFromAABB(vec3(-512, -16, -512), vec3(512, 0, 512)));
  return new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 0.5, 0));
}

describe('categorizePosition upward-velocity cutoff', () => {
  it('stays grounded just under NON_JUMP_VELOCITY (140) and lifts off just over it', () => {
    const slow = standingPlayer();
    slow.velocity.y = NON_JUMP_VELOCITY - 1;
    categorizePosition(slow);
    expect(slow.onGround).toBe(true);

    const fast = standingPlayer();
    fast.velocity.y = NON_JUMP_VELOCITY + 1;
    categorizePosition(fast);
    expect(fast.onGround).toBe(false);
  });
});

describe('categorizePosition surface friction', () => {
  function airbornePlayer(vy: number): PlayerController {
    const player = new PlayerController(new World(), structuredClone(DEFAULT_SETTINGS), vec3(0, 100, 0));
    player.velocity.y = vy;
    return player;
  }

  it('drops to 0.25 when rising slowly with no ground below', () => {
    const player = airbornePlayer(50);
    categorizePosition(player);
    expect(player.onGround).toBe(false);
    expect(player.surfaceFriction).toBe(0.25);
  });

  it('stays 1 when falling, or rising fast enough to be a jump', () => {
    const falling = airbornePlayer(-50);
    categorizePosition(falling);
    expect(falling.surfaceFriction).toBe(1);

    const jumping = airbornePlayer(NON_JUMP_VELOCITY + 50);
    jumping.surfaceFriction = 0.25;
    categorizePosition(jumping);
    expect(jumping.surfaceFriction).toBe(1);
  });
});

describe('categorizePosition ground following', () => {
  it('stays grounded walking off a 10-unit drop (extra STEP_HEIGHT trace) and snaps down', () => {
    const world = new World();
    world.solids.push(brushFromAABB(vec3(-512, -16, -512), vec3(512, -10, 512)));
    const player = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, -9.5, 0));
    player.onGround = true;
    categorizePosition(player);
    expect(player.onGround).toBe(true);
    expect(player.origin.y).toBeCloseTo(-10, 1);
  });

  it('does not snap a landing player down; only a grounded one follows the floor', () => {
    const player = standingPlayer(); // origin.y 0.5, floor top at 0
    categorizePosition(player);
    expect(player.onGround).toBe(true);
    expect(player.origin.y).toBe(0.5);
  });

  it('falls back to hull quadrants when the full hull hits only a steep plane', () => {
    const world = new World();
    const player = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 5, 0));
    const steep = vec3(0.866, 0.5, 0);
    const flat = vec3(0, 1, 0);
    // Full hull and every quadrant except the (+x,+z) one see only the steep
    // plane; the (+x,+z) quadrant (mins.x === mins.z === 0) sees walkable floor.
    world.trace = (start, _end, mins, _maxs, out = createTraceResult()) => {
      out.fraction = 0.5;
      out.startSolid = false;
      out.allSolid = false;
      out.endPos = vec3(start.x, 4, start.z);
      out.normal = mins.x === 0 && mins.z === 0 ? flat : steep;
      return out;
    };
    categorizePosition(player);
    expect(player.onGround).toBe(true);
    expect(player.groundNormal.y).toBe(1);
  });
});

