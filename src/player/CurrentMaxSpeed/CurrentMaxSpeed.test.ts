import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { brushFromAABB } from '../../physics/Collision/Collision';
import { World } from '../../physics/World/World';
import { DEFAULT_SETTINGS } from '../../settings/Settings';
import { PlayerController } from '../PlayerController';
import { accelerateModifiers, currentMaxSpeed } from './CurrentMaxSpeed';

function player(): PlayerController {
  const world = new World();
  world.solids.push(brushFromAABB(vec3(-512, -16, -512), vec3(512, 0, 512)));
  return new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 0.5, 0));
}

describe('currentMaxSpeed walk handling (CheckParameters)', () => {
  it('walk crops max speed to 130 only while within 25 u/s of walk speed', () => {
    const p = player();
    p.input.walk = true;
    p.velocity.x = 150;
    expect(currentMaxSpeed(p)).toBe(DEFAULT_SETTINGS.walkSpeed);
    p.velocity.x = 160;
    expect(currentMaxSpeed(p)).toBe(DEFAULT_SETTINGS.runSpeed);
  });

  it('ignores the walk key while ducking', () => {
    const p = player();
    p.input.walk = true;
    p.ducked = true;
    expect(currentMaxSpeed(p)).toBe(DEFAULT_SETTINGS.crouchSpeed);
    expect(accelerateModifiers(p).walking).toBe(false);
  });

  it('derives the acceleration factor from the configured speeds', () => {
    const p = player();
    expect(accelerateModifiers(p).speedFactor).toBe(1);
    p.input.walk = true;
    expect(accelerateModifiers(p).speedFactor).toBeCloseTo(0.52, 6);
    p.input.walk = false;
    p.ducked = true;
    expect(accelerateModifiers(p).speedFactor).toBeCloseTo(0.34, 6);
  });
});
