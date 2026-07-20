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
      perf: { enabled: true, greyWindowTicks: 4, bonusFactor: 0.2, autobhopChance: 0.42 },
    });
    expect(delayedRejump(settings, 0).quality).toBe('perfect');
    expect(delayedRejump(settings, 2).quality).toBe('grey');
    expect(delayedRejump(settings, 10).quality).toBe('normal');
  });

  it('gives an immediate rejump a bigger takeoff-speed boost than a late one', () => {
    const settings = makeSettings({
      autobhop: false,
      bhopSpeedClamp: false,
      perf: { enabled: true, greyWindowTicks: 4, bonusFactor: 0.2, autobhopChance: 0.42 },
    });
    const perfect = delayedRejump(settings, 0);
    const grey = delayedRejump(settings, 2);
    const normal = delayedRejump(settings, 10);

    expect(perfect.ratio).toBeCloseTo(1.2, 2); // full bonusFactor, no air-accel noise possible here
    expect(perfect.ratio).toBeGreaterThan(grey.ratio);
    expect(grey.ratio).toBeGreaterThan(normal.ratio);
  });
});

describe('perf bonus under autobhop: chance-based instead of guaranteed', () => {
  it('defaults autobhopChance to 0.42', () => {
    expect(DEFAULT_SETTINGS.perf.autobhopChance).toBe(0.42);
  });

  it('rolls perfect/bonus when the injected rng lands under the chance, normal otherwise', () => {
    const settings = makeSettings({
      autobhop: true,
      perf: { enabled: true, greyWindowTicks: 4, bonusFactor: 0.2, autobhopChance: 0.42 },
    });

    const hits = new PlayerController(makeWorld(), settings, vec3(0, 5, 0), { rng: () => 0.1 });
    hits.input.forward = true;
    run(hits, 64);
    hits.input.jump = true;
    run(hits, 1);
    expect(hits.lastHopQuality).toBe('perfect');

    const misses = new PlayerController(makeWorld(), settings, vec3(0, 5, 0), { rng: () => 0.9 });
    misses.input.forward = true;
    run(misses, 64);
    misses.input.jump = true;
    run(misses, 1);
    expect(misses.lastHopQuality).toBe('normal');
  });

  it('applies the takeoff-speed bonus only on the perfect roll, never on the missed roll', () => {
    const settings = makeSettings({
      autobhop: true,
      bhopSpeedClamp: false,
      perf: { enabled: true, greyWindowTicks: 4, bonusFactor: 0.3, autobhopChance: 0.42 },
    });

    function speedRatio(rng: () => number): number {
      const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0), { rng });
      player.input.forward = true;
      run(player, 64);
      const before = player.horizontalSpeed;
      player.input.jump = true;
      run(player, 1);
      return player.horizontalSpeed / before;
    }

    expect(speedRatio(() => 0.1)).toBeCloseTo(1.3, 2);
    expect(speedRatio(() => 0.9)).toBeCloseTo(1.0, 2);
  });

  it('over many jumps, the perfect rate roughly tracks autobhopChance', () => {
    const settings = makeSettings({
      autobhop: true,
      perf: { enabled: true, greyWindowTicks: 4, bonusFactor: 0.1, autobhopChance: 0.42 },
    });
    let call = 0;
    // A simple deterministic sequence covering [0,1) evenly, standing in for Math.random.
    const rng = () => {
      call++;
      return (call * 0.6180339887) % 1;
    };
    // Jumping in place (no forward hold) -- 500 hop cycles at ~0.76s of
    // hangtime each is ~380s of simulated time, more than enough at a
    // sustained 275 u/s to walk off the edge of this test world's finite
    // floor (+-8192) if forward were held the whole time.
    const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0), { rng });
    run(player, 64);

    let perfectCount = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      player.input.jump = false;
      while (!player.onGround) run(player, 1); // ride the arc back down first
      player.input.jump = true;
      run(player, 1); // the hop under test
      if (player.lastHopQuality === 'perfect') perfectCount++;
    }
    const rate = perfectCount / trials;
    expect(rate).toBeGreaterThan(0.35);
    expect(rate).toBeLessThan(0.49);
  });
});
