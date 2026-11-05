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
    p.duckFrac = 1;
    expect(currentMaxSpeed(p)).toBeCloseTo(DEFAULT_SETTINGS.crouchSpeed, 6);
    expect(accelerateModifiers(p).walking).toBe(false);
  });

  it('derives the acceleration factor from the configured speeds', () => {
    const p = player();
    expect(accelerateModifiers(p).ducking).toBe(false);
    p.input.walk = true;
    expect(accelerateModifiers(p).walkModifier).toBeCloseTo(0.52, 6);
    p.input.walk = false;
    p.ducked = true;
    expect(accelerateModifiers(p).duckModifier).toBeCloseTo(0.34, 6);
  });
});

describe('weapon speed and velocity modifier', () => {
  it('uses the active weapon speed as the base, capped at run speed', () => {
    const p = player();
    p.weapon = { maxSpeed: 200, scoped: false };
    expect(currentMaxSpeed(p)).toBe(200);
    p.weapon = { maxSpeed: 400, scoped: false };
    expect(currentMaxSpeed(p)).toBe(DEFAULT_SETTINGS.runSpeed);
  });

  it('derives walk and crouch from the weapon speed', () => {
    const p = player();
    p.weapon = { maxSpeed: 200, scoped: false };
    p.input.walk = true;
    expect(currentMaxSpeed(p)).toBeCloseTo(200 * 0.52, 6);
    p.input.walk = false;
    p.ducked = true;
    p.duckFrac = 1;
    expect(currentMaxSpeed(p)).toBeCloseTo(200 * 0.34, 6);
  });

  it('flags a slow scoped sniper only when scoped and slow enough', () => {
    const p = player();
    p.weapon = { maxSpeed: 150, scoped: true };
    expect(accelerateModifiers(p).slowSniperScoped).toBe(true); // 150 * 0.52 = 78 < 110
    p.weapon = { maxSpeed: 240, scoped: true };
    expect(accelerateModifiers(p).slowSniperScoped).toBe(false);
    p.weapon = { maxSpeed: 150, scoped: false };
    expect(accelerateModifiers(p).slowSniperScoped).toBe(false);
  });

  it('ignores weapon speed in acceleration when sv_accelerate_use_weapon_speed is off', () => {
    const p = player();
    p.settings.physics.accelerateUseWeaponSpeed = false;
    p.weapon = { maxSpeed: 150, scoped: true };
    expect(accelerateModifiers(p).weaponFactor).toBe(1);
    expect(accelerateModifiers(p).slowSniperScoped).toBe(false);
  });

  it('applies the velocity modifier on the ground only', () => {
    const p = player();
    p.velocityModifier = 0.5;
    p.onGround = true;
    expect(currentMaxSpeed(p)).toBeCloseTo(DEFAULT_SETTINGS.runSpeed * 0.5, 6);
    p.onGround = false;
    expect(currentMaxSpeed(p)).toBe(DEFAULT_SETTINGS.runSpeed);
  });
});

