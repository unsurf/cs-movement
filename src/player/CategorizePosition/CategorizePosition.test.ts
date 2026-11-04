import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { brushFromAABB } from '../../physics/Collision/Collision';
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
