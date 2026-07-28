import { describe, expect, it } from 'vitest';
import { GRAVITY } from '../../constants';
import { vec3 } from '../../math/vec3';
import { World } from '../../physics/World/World';
import { brushFromAABB, brushFromOrientedBox } from '../../physics/Collision/Collision';
import { PlayerController } from '../PlayerController';
import { DEFAULT_SETTINGS } from '../../settings/Settings';
import type { Settings } from '../../settings/Settings';
import { JUMP_VELOCITY } from './Jump.config';

const DT = 1 / 128;

describe('jump + gravity integration', () => {
  it('reaches ~57 units with half-gravity applied around the move', () => {
    let y = 0;
    let v = JUMP_VELOCITY;
    let maxY = 0;
    for (let i = 0; i < 256; i++) {
      v -= 0.5 * GRAVITY * DT;
      y += v * DT;
      v -= 0.5 * GRAVITY * DT;
      if (y > maxY) maxY = y;
    }
    expect(maxY).toBeGreaterThan(56);
    expect(maxY).toBeLessThan(57.5);
  });
});

// bhopSpeedClamp coverage (the only speed limit outside perf.enabled) lives
// in PlayerController.test.ts — it needs a full autobhop+air-strafe
// simulation to exercise properly, which that file already sets up.

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

/** Takes one jump and rides it back to the ground, purely to satisfy
 * hasJumpedBefore — the very first jump of a life never chains. */
function primeWithOneJump(player: PlayerController): void {
  while (!player.onGround) run(player, 1); // checkJump needs onGround true to do anything
  player.input.jump = true;
  run(player, 1);
  player.input.jump = false;
  while (!player.onGround) run(player, 1);
}

describe('perf: perfect-bhop velocity carry (opt-in, disabled by default)', () => {
  it('is a no-op by default: lastHopQuality is never set', () => {
    const settings = makeSettings({ autobhop: false });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0));
    primeWithOneJump(player);
    player.input.jump = true;
    run(player, 1);
    expect(player.lastHopQuality).toBeNull();
  });

  it('an exact instant manual rejump carries the landing velocity, bypassing bhopSpeedClamp', () => {
    const settings = makeSettings({
      autobhop: false,
      bhopSpeedClamp: true,
      perf: { enabled: true, maxAirSpeed: 10000 }, // effectively no ceiling here
    });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0));
    primeWithOneJump(player);
    run(player, 64); // well clear of the priming jump

    // Build real prestrafe speed well above the vanilla clamp, off a long drop.
    player.origin.y = 3000;
    player.onGround = false;
    player.input.right = true;
    while (!player.onGround) {
      player.yaw -= 3;
      run(player, 1);
    }
    const landingSpeed = player.horizontalSpeed;
    expect(landingSpeed).toBeGreaterThan(DEFAULT_SETTINGS.runSpeed * 1.5); // sanity: real prestrafe gain happened

    player.input.right = false;
    player.input.jump = true;
    run(player, 1); // the instant rejump under test
    expect(player.lastHopQuality).toBe('perfect');
    expect(player.horizontalSpeed).toBeCloseTo(landingSpeed, 1); // carried, not clamped down to ~275
  });

  it('a rejump even one tick late gets nothing — no partial credit', () => {
    const settings = makeSettings({
      autobhop: false,
      perf: { enabled: true, maxAirSpeed: 10000 },
    });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0));
    primeWithOneJump(player);
    run(player, 64);

    player.origin.y = 3000;
    player.onGround = false;
    player.input.right = true;
    while (!player.onGround) {
      player.yaw -= 3;
      run(player, 1);
    }
    const landingSpeed = player.horizontalSpeed;
    player.input.right = false;

    run(player, 1); // one tick late — not the instant rejump
    player.input.jump = true;
    run(player, 1);
    expect(player.lastHopQuality).toBe('normal');
    expect(player.horizontalSpeed).toBeLessThan(landingSpeed - 1); // not carried
  });

  it('autobhop never gets the carry, even at 0 ticks late', () => {
    const settings = makeSettings({
      autobhop: true,
      perf: { enabled: true, maxAirSpeed: 10000 },
    });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0));
    primeWithOneJump(player);
    run(player, 64);

    player.origin.y = 3000;
    player.onGround = false;
    player.input.right = true;
    while (!player.onGround) {
      player.yaw -= 3;
      run(player, 1);
    }
    const landingSpeed = player.horizontalSpeed;
    player.input.right = false;

    player.input.jump = true; // held — autobhop re-fires on the very next tick
    run(player, 1);
    expect(player.lastHopQuality).toBe('normal');
    expect(player.horizontalSpeed).toBeLessThan(landingSpeed - 1); // not carried, despite 0 ticks late
  });

  it('a jump with no prior jump to chain from never carries, however high the landing speed', () => {
    const settings = makeSettings({
      autobhop: false,
      perf: { enabled: true, maxAirSpeed: 10000 },
    });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 3000, 0));
    player.input.right = true;
    while (!player.onGround) {
      player.yaw -= 3;
      run(player, 1);
    }
    player.input.right = false;
    player.input.jump = true;
    run(player, 1); // the very first jump of this life — instant, but can't chain
    expect(player.lastHopQuality).toBe('normal');
  });

  it('a landing that came off a surf ramp never carries, even on an instant rejump', () => {
    const ax = vec3(1, 0, 0);
    const ay = vec3(0, 0.5, Math.sqrt(1 - 0.25));
    const az = vec3(0, -Math.sqrt(1 - 0.25), 0.5); // ax × ay
    const world = makeWorld();
    world.solids.push(brushFromOrientedBox(vec3(0, 600, 0), vec3(400, 20, 400), ax, ay, az));

    const settings = makeSettings({
      autobhop: false,
      perf: { enabled: true, maxAirSpeed: 10000 },
    });
    const player = new PlayerController(world, settings, vec3(0, 5, 0));
    primeWithOneJump(player);
    run(player, 64);

    player.origin.y = 2000;
    player.onGround = false;
    player.input.right = true;
    let sawSurf = false;
    while (!player.onGround) {
      player.yaw -= 3;
      run(player, 1);
      if (player.surfing) sawSurf = true;
    }
    expect(sawSurf).toBe(true); // sanity: this genuinely touched the surf ramp
    const landingSpeed = player.horizontalSpeed;
    player.input.right = false;

    player.input.jump = true;
    run(player, 1); // instant rejump — would be "perfect" if not for the surf touch
    expect(player.lastHopQuality).toBe('normal');
    expect(player.horizontalSpeed).toBeLessThan(landingSpeed - 1);
  });

  it('never exceeds maxAirSpeed by more than the softness tolerance, however long a real chain runs', () => {
    // Manual mode, always hitting the instant rejump — the only way to get
    // repeated perfect carries without autobhop (which never qualifies).
    const settings = makeSettings({
      autobhop: false,
      perf: { enabled: true, maxAirSpeed: 390 },
    });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0));
    primeWithOneJump(player);

    let maxSpeedEver = 0;
    let hopCount = 0;
    for (let cycle = 0; cycle < 60; cycle++) {
      player.input.right = true;
      player.input.jump = true;
      run(player, 1); // instant rejump from the previous landing
      player.input.jump = false;
      hopCount++;
      while (!player.onGround) {
        player.yaw -= 3;
        run(player, 1);
        maxSpeedEver = Math.max(maxSpeedEver, player.horizontalSpeed);
      }
      player.input.right = false;
    }
    expect(hopCount).toBe(60);
    expect(maxSpeedEver).toBeGreaterThan(DEFAULT_SETTINGS.runSpeed * 1.5); // sanity: a real chain happened
    expect(maxSpeedEver).toBeLessThan(settings.perf.maxAirSpeed + 20);
  });

  it('surfing is exempt from the air-speed ceiling — a ramp can legitimately exceed maxAirSpeed', () => {
    const ax = vec3(1, 0, 0);
    const ay = vec3(0, 0.5, Math.sqrt(1 - 0.25));
    const az = vec3(0, -Math.sqrt(1 - 0.25), 0.5); // ax × ay
    const world = makeWorld();
    world.solids.push(brushFromOrientedBox(vec3(0, 600, 0), vec3(400, 20, 400), ax, ay, az));

    const settings = makeSettings({
      perf: { enabled: true, maxAirSpeed: 390 },
    });
    const player = new PlayerController(world, settings, vec3(0, 2000, 0));
    player.input.right = true;
    let maxSpeed = 0;
    let sawSurf = false;
    for (let i = 0; i < 3000 && !player.onGround; i++) {
      player.yaw -= 3;
      run(player, 1);
      if (player.surfing) sawSurf = true;
      maxSpeed = Math.max(maxSpeed, player.horizontalSpeed);
    }
    expect(sawSurf).toBe(true); // sanity: this genuinely touched the surf ramp
    expect(maxSpeed).toBeGreaterThan(settings.perf.maxAirSpeed * 1.3); // uncapped — surf is meant to exceed it
  });
});
