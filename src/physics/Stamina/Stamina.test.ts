import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { World } from '../World/World';
import { brushFromAABB } from '../Collision/Collision';
import { PlayerController } from '../../player/PlayerController';
import { DEFAULT_SETTINGS } from '../../settings/Settings';
import type { Settings } from '../../settings/Settings';
import { GRAVITY } from '../../constants';
import { JUMP_VELOCITY } from '../../player/Jump/Jump.config';
import { currentMaxSpeed } from '../../player/CurrentMaxSpeed/CurrentMaxSpeed';
import { addStamina, recoverStamina, staminaJumpMultiplier, staminaSpeedMultiplier } from './Stamina';

const DT = 1 / 128;

// Numbers below are CS:GO's: sv_staminamax 80, jump cost 0.08 per u/s of
// impulse, landing cost 0.05 per u/s of fall speed, recovery 60/s, and a
// (1 - stamina/100) jump multiplier / squared speed multiplier.

describe('addStamina', () => {
  it('clamps to the pool max', () => {
    expect(addStamina(70, 30, 80)).toBe(80);
    expect(addStamina(20, 30, 80)).toBe(50);
  });
});

describe('recoverStamina', () => {
  it('drains at units per second and clamps at 0', () => {
    expect(recoverStamina(80, 60, 0.5)).toBe(50);
    expect(recoverStamina(20, 60, 0.5)).toBe(0);
  });
});

describe('stamina multipliers', () => {
  it('jump is 1 - stamina/100; speed is that squared', () => {
    expect(staminaJumpMultiplier(0)).toBe(1);
    expect(staminaJumpMultiplier(50)).toBe(0.5);
    expect(staminaSpeedMultiplier(50)).toBe(0.25);
    expect(staminaJumpMultiplier(100)).toBe(0);
    expect(staminaJumpMultiplier(250)).toBe(0);
  });
});

function makeWorld(): World {
  const world = new World();
  world.solids.push(brushFromAABB(vec3(-8192, -64, -8192), vec3(8192, 0, 8192)));
  return world;
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...structuredClone(DEFAULT_SETTINGS), ...overrides };
}

function run(player: PlayerController, ticks: number, perTick?: () => void): void {
  for (let i = 0; i < ticks; i++) {
    perTick?.();
    player.tick(DT);
  }
}

describe('stamina (opt-in, disabled by default)', () => {
  const enabled = (overrides: Partial<Settings['stamina']> = {}): Settings =>
    makeSettings({ stamina: { ...DEFAULT_SETTINGS.stamina, enabled: true, ...overrides } });

  it('is a no-op by default: jump apex matches the disabled baseline exactly', () => {
    const player = new PlayerController(makeWorld(), makeSettings(), vec3(0, 5, 0));
    run(player, 64);
    player.input.jump = true;
    let apex = 0;
    run(player, 200, () => {
      apex = Math.max(apex, player.origin.y);
    });
    expect(apex).toBeGreaterThan(55.5);
    expect(apex).toBeLessThan(58);
    expect(player.stamina).toBe(0);
  });

  it('a jump adds 0.08 stamina per u/s of vertical impulse', () => {
    const player = new PlayerController(makeWorld(), enabled(), vec3(0, 5, 0));
    run(player, 64);
    player.input.jump = true;
    run(player, 1);
    // Impulse the jump added = JUMP_VELOCITY - the half-tick of gravity StartGravity had already taken.
    expect(player.stamina).toBeCloseTo(0.08 * (JUMP_VELOCITY - 0.5 * GRAVITY * DT), 3);
  });

  it('existing stamina scales the whole jump by (1 - stamina/100)', () => {
    const fresh = new PlayerController(makeWorld(), enabled({ recoveryRate: 0 }), vec3(0, 5, 0));
    const tired = new PlayerController(makeWorld(), enabled({ recoveryRate: 0 }), vec3(0, 5, 0));
    run(fresh, 64);
    run(tired, 64);
    tired.stamina = 50;
    fresh.input.jump = tired.input.jump = true;
    run(fresh, 1);
    run(tired, 1);
    const half = 0.5 * GRAVITY * DT;
    // StartGravity -h, += impulse, x0.5 for stamina, then one h inside the jump and one at the end of the tick.
    expect(tired.velocity.y).toBeCloseTo((JUMP_VELOCITY - half) * 0.5 - 2 * half, 3);
    expect(tired.velocity.y).toBeLessThan(fresh.velocity.y * 0.55);
  });

  it('max speed is cut by (1 - stamina/100)^2', () => {
    const player = new PlayerController(makeWorld(), enabled(), vec3(0, 5, 0));
    player.stamina = 50;
    expect(currentMaxSpeed(player)).toBeCloseTo(DEFAULT_SETTINGS.runSpeed * 0.25, 6);
  });

  it('landing adds 0.05 stamina per u/s of fall speed', () => {
    const player = new PlayerController(makeWorld(), enabled({ recoveryRate: 0 }), vec3(0, 400, 0));
    let peakFall = 0;
    for (let i = 0; i < 400 && player.stamina === 0; i++) {
      peakFall = Math.max(peakFall, -player.velocity.y);
      player.tick(DT);
    }
    expect(player.onGround).toBe(true);
    expect(player.stamina).toBeGreaterThan(0.05 * peakFall * 0.9);
    expect(player.stamina).toBeLessThan(0.05 * peakFall * 1.1);
  });

  it('recovers at recoveryRate units per second', () => {
    const player = new PlayerController(makeWorld(), enabled({ recoveryRate: 60 }), vec3(0, 5, 0));
    run(player, 64);
    player.stamina = 30;
    run(player, 64); // half a second
    expect(player.stamina).toBeCloseTo(0, 5);
    player.stamina = 80;
    run(player, 64);
    expect(player.stamina).toBeCloseTo(50, 3);
  });
});
