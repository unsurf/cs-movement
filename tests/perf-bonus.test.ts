import { describe, expect, it } from 'vitest';
import { vec3 } from '../src/math/vec3';
import { World, brushFromAABB } from '../src/physics/Collision';
import { PlayerController } from '../src/player/PlayerController';
import { DEFAULT_SETTINGS, type Settings } from '../src/settings';

const DT = 1 / 128;

function makeWorld(): World {
  const world = new World();
  world.solids.push(brushFromAABB(vec3(-8192, -64, -8192), vec3(8192, 0, 8192)));
  return world;
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...structuredClone(DEFAULT_SETTINGS), ...overrides };
}

function run(player: PlayerController, ticks: number): void {
  for (let i = 0; i < ticks; i++) player.tick(DT);
}

/**
 * Takes one hop, waits until grounded again, then waits `delayTicks` more
 * ground ticks (each bleeding a little speed to friction) before rejumping.
 * Returns the horizontal-speed ratio across just that final takeoff tick,
 * and the hop-quality classification perf assigned to it.
 */
function delayedRejump(
  settings: Settings,
  delayTicks: number,
): { ratio: number; quality: 'perfect' | 'grey' | 'normal' | null } {
  const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0));
  player.input.forward = true;
  run(player, 64); // reach steady ground speed

  player.input.jump = true;
  run(player, 1); // takeoff
  player.input.jump = false;
  while (!player.onGround) run(player, 1); // ride the arc back down

  run(player, delayTicks); // extra ground-friction ticks before the rejump

  const before = player.horizontalSpeed;
  player.input.jump = true;
  run(player, 1); // the rejump under test
  return { ratio: player.horizontalSpeed / before, quality: player.lastHopQuality };
}

describe('perf bonus (opt-in, disabled by default)', () => {
  it('is a no-op by default: lastHopQuality is never set', () => {
    const { quality } = delayedRejump(makeSettings({ autobhop: false }), 0);
    expect(quality).toBeNull();
  });

  it('classifies takeoffs as perfect / grey / normal by ticks since landing', () => {
    const settings = makeSettings({
      autobhop: false,
      bhopSpeedClamp: false,
      perf: { enabled: true, greyWindowTicks: 4, bonusFactor: 0.2 },
    });
    expect(delayedRejump(settings, 0).quality).toBe('perfect');
    expect(delayedRejump(settings, 2).quality).toBe('grey');
    expect(delayedRejump(settings, 10).quality).toBe('normal');
  });

  it('gives an immediate rejump a bigger takeoff-speed boost than a late one', () => {
    const settings = makeSettings({
      autobhop: false,
      bhopSpeedClamp: false,
      perf: { enabled: true, greyWindowTicks: 4, bonusFactor: 0.2 },
    });
    const perfect = delayedRejump(settings, 0);
    const grey = delayedRejump(settings, 2);
    const normal = delayedRejump(settings, 10);

    expect(perfect.ratio).toBeCloseTo(1.2, 2); // full bonusFactor, no air-accel noise possible here
    expect(perfect.ratio).toBeGreaterThan(grey.ratio);
    expect(grey.ratio).toBeGreaterThan(normal.ratio);
  });
});
