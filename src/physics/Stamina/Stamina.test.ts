import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { World } from '../World/World';
import { brushFromAABB } from '../Collision/Collision';
import { PlayerController } from '../../player/PlayerController';
import { DEFAULT_SETTINGS } from '../../settings/Settings';
import type { Settings } from '../../settings/Settings';
import { addStamina, recoverStamina, staminaPenaltyMultiplier } from './Stamina';

const DT = 1 / 128;

describe('addStamina', () => {
  it('clamps to max', () => {
    expect(addStamina(0.9, 0.3, 1)).toBe(1);
    expect(addStamina(0.2, 0.3, 1)).toBeCloseTo(0.5, 10);
  });
});

describe('recoverStamina', () => {
  it('decays toward 0 and clamps there', () => {
    expect(recoverStamina(1, 0.5, 1, 1)).toBeCloseTo(0.5, 10);
    expect(recoverStamina(0.1, 0.5, 1, 1)).toBe(0);
  });
});

describe('staminaPenaltyMultiplier', () => {
  it('is 1 at empty and 1 - maxPenalty at full', () => {
    expect(staminaPenaltyMultiplier(0, 1, 0.4)).toBe(1);
    expect(staminaPenaltyMultiplier(1, 1, 0.4)).toBeCloseTo(0.6, 10);
    expect(staminaPenaltyMultiplier(0.5, 1, 0.4)).toBeCloseTo(0.8, 10);
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

  it('drains on repeated jumps and throttles jump height + ground speed', () => {
    const settings = makeSettings({
      stamina: { ...DEFAULT_SETTINGS.stamina, enabled: true, jumpCost: 0.3, landCost: 0.2, recoveryRate: 0 },
    });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0));
    run(player, 64); // settle on the ground

    const apexes: number[] = [];
    for (let hop = 0; hop < 3; hop++) {
      player.input.jump = true;
      let apex = 0;
      run(player, 200, () => {
        apex = Math.max(apex, player.origin.y);
      });
      apexes.push(apex);
      player.input.jump = false;
      run(player, 4); // let it settle so the next jump is a fresh press
    }

    expect(player.stamina).toBeGreaterThan(0);
    expect(apexes[2]).toBeLessThan(apexes[0]); // fatigued jump is lower than the fresh one

    player.input.forward = true;
    run(player, 512);
    const staminaCappedSpeed = player.horizontalSpeed;

    const freshSettings = makeSettings({ stamina: { ...DEFAULT_SETTINGS.stamina, enabled: false } });
    const freshPlayer = new PlayerController(makeWorld(), freshSettings, vec3(0, 5, 0));
    freshPlayer.input.forward = true;
    run(freshPlayer, 512);
    expect(staminaCappedSpeed).toBeLessThan(freshPlayer.horizontalSpeed);
  });

  it('recovers over time', () => {
    const settings = makeSettings({
      stamina: { ...DEFAULT_SETTINGS.stamina, enabled: true, jumpCost: 0.5, landCost: 0, recoveryRate: 1 },
    });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0));
    run(player, 64);
    player.input.jump = true;
    run(player, 1);
    player.input.jump = false;
    expect(player.stamina).toBeCloseTo(0.5, 5);

    run(player, 256); // 2 seconds at recoveryRate 1/s should fully drain it
    expect(player.stamina).toBe(0);
  });
});
