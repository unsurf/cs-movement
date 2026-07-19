// Ladder movement: fixed climb speed, and the CS:GO fastclimb — aiming
// diagonally into the ladder with W+strafe stacks both inputs for ~1.41x
// climb speed (the wish vector is deliberately not normalized).

import { describe, expect, it } from 'vitest';
import { vec3 } from '../src/math/vec3';
import { World, brushFromAABB, type LadderVolume } from '../src/physics/Collision';
import { PlayerController } from '../src/player/PlayerController';
import { DEFAULT_SETTINGS, type Settings } from '../src/settings';

const DT = 1 / 128;

function makeSettings(): Settings {
  return structuredClone(DEFAULT_SETTINGS);
}

/** Wall at x 100 with a west-facing ladder volume in front of it. */
function ladderWorld(): World {
  const world = new World();
  world.solids.push(brushFromAABB(vec3(-512, -64, -512), vec3(512, 0, 512))); // floor
  world.solids.push(brushFromAABB(vec3(100, 0, -200), vec3(164, 600, 200))); // wall
  const volume: LadderVolume = {
    ...brushFromAABB(vec3(60, 0, -24), vec3(100, 600, 24)),
    facing: vec3(-1, 0, 0),
  };
  world.ladders.push(volume);
  return world;
}

function climbFor(yaw: number, right: boolean, ticks: number): number {
  const player = new PlayerController(ladderWorld(), makeSettings(), vec3(70, 5, 0));
  player.yaw = yaw;
  player.pitch = 0;
  player.input.forward = true;
  player.input.right = right;
  for (let i = 0; i < ticks; i++) player.tick(DT);
  return player.origin.y;
}

describe('ladders', () => {
  it('climbs at the fixed climb speed holding forward into the ladder', () => {
    // yaw -90 faces +x, straight into the wall.
    const y = climbFor(-90, false, 128);
    expect(y).toBeGreaterThan(150);
    expect(y).toBeLessThan(220);
  });

  it('fastclimbs ~1.41x with diagonal aim + W+strafe', () => {
    const base = climbFor(-90, false, 128);
    // yaw -45: both forward and strafe-right point 45° into the wall.
    const fast = climbFor(-45, true, 128);
    expect(fast).toBeGreaterThan(base * 1.3);
    expect(fast).toBeLessThan(base * 1.5);
  });

  it('jumping off pushes away from the face', () => {
    const player = new PlayerController(ladderWorld(), makeSettings(), vec3(70, 5, 0));
    player.yaw = -90;
    player.input.forward = true;
    for (let i = 0; i < 64; i++) player.tick(DT);
    expect(player.onLadder).not.toBeNull();
    player.input.forward = false;
    player.input.jump = true;
    player.tick(DT);
    expect(player.onLadder).toBeNull();
    expect(player.velocity.x).toBeLessThan(-200); // pushed off toward -x
  });
});
