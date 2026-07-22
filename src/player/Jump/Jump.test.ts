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
 * hasJumpedBefore so a subsequent takeoff is eligible for perf classification
 * at all — the very first jump of a life never is (see Jump.ts). */
function primeWithOneJump(player: PlayerController): void {
  while (!player.onGround) run(player, 1); // checkJump needs onGround true to do anything
  player.input.jump = true;
  run(player, 1);
  player.input.jump = false;
  while (!player.onGround) run(player, 1);
}

/**
 * Takes one hop, waits until grounded again, then waits `delayTicks` more
 * ground ticks (each bleeding a little speed to friction) before rejumping.
 * Returns the hop-quality classification perf assigned to that rejump.
 */
function delayedRejump(settings: Settings, delayTicks: number): 'perfect' | 'grey' | 'normal' | null {
  const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0));
  player.input.forward = true;
  run(player, 64); // reach steady ground speed

  primeWithOneJump(player); // the very first jump ever can never chain — see below

  player.input.jump = true;
  run(player, 1); // takeoff
  player.input.jump = false;
  while (!player.onGround) run(player, 1); // ride the arc back down

  run(player, delayTicks); // extra ground-friction ticks before the rejump

  player.input.jump = true;
  run(player, 1); // the rejump under test
  return player.lastHopQuality;
}

/**
 * Builds real prestrafe speed well above run speed during a long airborne
 * drop, lands on flat ground, waits `delayTicks` ground ticks with no input
 * at all (friction bleeding speed the whole time, no accelerate to counter
 * it), then rejumps. Returns the speed right after the original landing,
 * right before the rejump (after it's decayed for `delayTicks`), and right
 * after the rejump — the difference between the last two is the carry the
 * perf mechanic actually contributed.
 */
function prestrafeLandThenRejump(
  settings: Settings,
  delayTicks: number,
): { landingSpeed: number; beforeRejump: number; afterRejump: number; quality: 'perfect' | 'grey' | 'normal' | null } {
  const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0));
  primeWithOneJump(player); // satisfies hasJumpedBefore with a clean, unremarkable hop
  run(player, 64); // well past any window — this priming jump must not itself get carried into the next one

  // A normal jump's ~0.94s of hangtime isn't enough runway to build much
  // prestrafe speed, so drop the player from height instead — same pattern
  // WalkMove.test.ts's landing test uses. hasJumpedBefore only needs one
  // real jump to have happened ever, not for THIS fall to be jump-launched.
  player.origin.y = 3000;
  player.onGround = false;
  player.input.right = true;
  let peakAirborne = 0;
  while (!player.onGround) {
    player.yaw -= 3;
    run(player, 1);
    peakAirborne = Math.max(peakAirborne, player.horizontalSpeed);
  }
  expect(peakAirborne).toBeGreaterThan(DEFAULT_SETTINGS.runSpeed * 1.5); // sanity: real prestrafe gain happened

  const landingSpeed = player.horizontalSpeed;
  player.input.right = false;
  run(player, delayTicks); // no input at all: pure friction decay, no accelerate to offset it

  const beforeRejump = player.horizontalSpeed;
  player.input.jump = true;
  run(player, 1); // the rejump under test
  return { landingSpeed, beforeRejump, afterRejump: player.horizontalSpeed, quality: player.lastHopQuality };
}

describe('perf: real bhop-assist velocity carry (opt-in, disabled by default)', () => {
  it('is a no-op by default: lastHopQuality is never set', () => {
    expect(delayedRejump(makeSettings({ autobhop: false }), 0)).toBeNull();
  });

  it('classifies takeoffs as perfect / grey / normal by ticks since landing', () => {
    const settings = makeSettings({
      autobhop: false,
      bhopSpeedClamp: false,
      perf: { enabled: true, maxBhopFrames: 4, framePenalty: 0.9, maxAirSpeed: 10000, autobhopChance: 0.38 }, // effectively no ceiling here; autobhop off in this block anyway
    });
    expect(delayedRejump(settings, 0)).toBe('perfect');
    expect(delayedRejump(settings, 2)).toBe('grey');
    expect(delayedRejump(settings, 10)).toBe('normal'); // past maxBhopFrames
  });

  it('carries landing speed back on an immediate rejump, decaying it the longer you wait, ' +
    'and not at all past the window', () => {
    const settings = makeSettings({
      autobhop: false,
      bhopSpeedClamp: false,
      perf: { enabled: true, maxBhopFrames: 4, framePenalty: 0.9, maxAirSpeed: 10000, autobhopChance: 0.38 }, // effectively no ceiling here; autobhop off in this block anyway
    });

    const perfect = prestrafeLandThenRejump(settings, 0);
    expect(perfect.quality).toBe('perfect');
    // 0 frames late: full carry back to the original landing speed.
    expect(perfect.afterRejump).toBeCloseTo(perfect.landingSpeed, 1);

    const grey = prestrafeLandThenRejump(settings, 2);
    expect(grey.quality).toBe('grey');
    // Friction already pulled it down by the time of the rejump; the carry
    // should land somewhere between that decayed speed and the original.
    expect(grey.afterRejump).toBeGreaterThan(grey.beforeRejump);
    expect(grey.afterRejump).toBeLessThan(grey.landingSpeed);

    const normal = prestrafeLandThenRejump(settings, 10); // past maxBhopFrames
    expect(normal.quality).toBe('normal');
    // No carry at all — the rejump is exactly whatever friction left it at.
    expect(normal.afterRejump).toBeCloseTo(normal.beforeRejump, 1);
    expect(normal.afterRejump).toBeLessThan(normal.landingSpeed);
  });

  it('a jump with no prior jump to chain from never carries anything, however high the landing speed', () => {
    // Regression: gravity settling the player onto the ground they spawned
    // on used to look exactly like a landing eligible for hop-chain timing,
    // so the very first jump of a life could still carry a "landing
    // velocity" that was never really earned.
    const settings = makeSettings({
      perf: { enabled: true, maxBhopFrames: 12, framePenalty: 0.975, maxAirSpeed: 10000, autobhopChance: 0.38 },
    });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0));
    run(player, 64); // settle onto the ground — not a jump landing
    player.input.jump = true;
    run(player, 1); // the very first jump
    expect(player.lastHopQuality).toBe('normal');
  });
});

describe('perf under autobhop: a per-hop chance roll, not deterministic', () => {
  // Regression: held-jump autobhop always re-fires at 0 ticks late, so
  // treating that as a guaranteed full carry every hop permanently defeats
  // bhopSpeedClamp — the carry restores whatever you landed with every
  // single time, so the clamp never gets a tick to actually hold speed
  // down. Confirmed against real nopre servers: holding autobhop with
  // bhopSpeedClamp on should float around baseline speed, not sit high.

  it('defaults autobhopChance to 0.38', () => {
    expect(DEFAULT_SETTINGS.perf.autobhopChance).toBe(0.38);
  });

  it('rolls autobhopChance per hop: a hit carries the landing velocity, a miss leaves the vanilla clamp alone', () => {
    const settings = makeSettings({
      autobhop: true,
      perf: { enabled: true, maxBhopFrames: 12, framePenalty: 0.975, maxAirSpeed: 10000, autobhopChance: 0.38 },
    });

    const hits = new PlayerController(makeWorld(), settings, vec3(0, 5, 0), { rng: () => 0 }); // always under 0.38
    primeWithOneJump(hits);
    hits.input.jump = true;
    run(hits, 1);
    expect(hits.lastHopQuality).toBe('perfect');

    const misses = new PlayerController(makeWorld(), settings, vec3(0, 5, 0), { rng: () => 0.99 }); // always over 0.38
    primeWithOneJump(misses);
    misses.input.jump = true;
    run(misses, 1);
    expect(misses.lastHopQuality).toBe('normal');
  });

  it('a missed roll leaves the takeoff at exactly what bhopSpeedClamp computed, not the raw landing velocity', () => {
    // The exact bug: under autobhop, a "perfect" carry used to be guaranteed
    // every hop (0 ticks late, always), which meant it unconditionally
    // restored the raw landing velocity and permanently defeated
    // bhopSpeedClamp — a miss has to actually leave the clamp's reduction
    // in place, not have it overwritten back up.
    const settings = makeSettings({
      autobhop: true,
      bhopSpeedClamp: true,
      perf: { enabled: true, maxBhopFrames: 12, framePenalty: 0.975, maxAirSpeed: 10000, autobhopChance: 0.38 },
    });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0), { rng: () => 0.99 }); // never perfs
    primeWithOneJump(player);
    run(player, 64); // well past any window

    // Build genuine high landing speed via prestrafe (same pattern as the
    // other carry tests), well above the ~275 vanilla clamp.
    player.origin.y = 3000;
    player.onGround = false;
    player.input.right = true;
    while (!player.onGround) {
      player.yaw -= 3;
      run(player, 1);
    }
    const landingSpeed = player.horizontalSpeed;
    expect(landingSpeed).toBeGreaterThan(DEFAULT_SETTINGS.runSpeed * 1.5); // sanity: real high landing speed

    player.input.right = false;
    player.input.jump = true;
    run(player, 1); // the rejump under test — always misses (rng: () => 0.99)
    expect(player.lastHopQuality).toBe('normal');
    const maxScaled = DEFAULT_SETTINGS.runSpeed * 1.1; // BHOP_MAX_SPEED_FACTOR
    expect(player.horizontalSpeed).toBeLessThanOrEqual(maxScaled + 0.5);
  });

  it('never exceeds maxAirSpeed by more than the softness tolerance, however long the chain runs', () => {
    // Regression: capping only at the takeoff instant (the carry) let
    // air-strafe gain between hops push the observed peak well past the
    // intended ceiling — ~1140 u/s in this exact scenario and still
    // climbing when takeoff-only capping was tried, ~490-520 even with a
    // tighter takeoff-only squeeze. The ceiling has to apply continuously
    // while airborne (AirMove.ts), not just at each carry, for "should
    // never exceed maxAirSpeed" to actually hold. Always winning the roll
    // (rng: () => 0) is the worst case for the ceiling.
    const settings = makeSettings({
      autobhop: true,
      perf: { enabled: true, maxBhopFrames: 12, framePenalty: 0.975, maxAirSpeed: 390, autobhopChance: 1 },
    });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0), { rng: () => 0 });
    player.input.right = true;
    player.input.jump = true;
    let maxSpeedEver = 0;
    let hopCount = 0;
    for (let i = 0; i < 20000; i++) {
      const wasGrounded = player.onGround;
      if (!wasGrounded) player.yaw -= 3; // continuous air-strafe technique
      run(player, 1);
      if (wasGrounded && !player.onGround) hopCount++;
      maxSpeedEver = Math.max(maxSpeedEver, player.horizontalSpeed);
    }
    expect(hopCount).toBeGreaterThan(50); // sanity: this genuinely chained many hops
    expect(maxSpeedEver).toBeGreaterThan(DEFAULT_SETTINGS.runSpeed * 1.5); // sanity: a real chain happened
    // Nowhere near the ~1140 (and still climbing) an uncapped chain reached
    // in this exact scenario — stays within the ceiling's softness margin.
    expect(maxSpeedEver).toBeLessThan(settings.perf.maxAirSpeed + 20);
  });

  it('surfing is exempt from the air-speed ceiling — a ramp can legitimately exceed maxAirSpeed', () => {
    const ax = vec3(1, 0, 0);
    const ay = vec3(0, 0.5, Math.sqrt(1 - 0.25));
    const az = vec3(0, -Math.sqrt(1 - 0.25), 0.5); // ax × ay
    const world = makeWorld();
    world.solids.push(brushFromOrientedBox(vec3(0, 600, 0), vec3(400, 20, 400), ax, ay, az));

    const settings = makeSettings({
      perf: { enabled: true, maxBhopFrames: 12, framePenalty: 0.975, maxAirSpeed: 390, autobhopChance: 0.38 },
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

  it('an isolated jump taken long after the last landing still gets the same autobhopChance roll', () => {
    // Under autobhop there's no separate "timing window" the way manual
    // mode has one: every hop, chained or isolated, rolls the same flat
    // chance — it's the roll itself, not recency, that decides.
    const settings = makeSettings({
      autobhop: true,
      perf: { enabled: true, maxBhopFrames: 4, framePenalty: 0.975, maxAirSpeed: 10000, autobhopChance: 0.38 },
    });
    const player = new PlayerController(makeWorld(), settings, vec3(0, 5, 0), { rng: () => 0 }); // always under 0.38
    primeWithOneJump(player); // satisfies hasJumpedBefore
    run(player, 64); // stand around well past maxBhopFrames before jumping again
    player.input.jump = true;
    run(player, 1); // an isolated jump, not a rejump
    expect(player.lastHopQuality).toBe('perfect'); // still eligible — autobhop doesn't gate on recency
  });
});
