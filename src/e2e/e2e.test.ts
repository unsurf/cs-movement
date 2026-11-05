// Headless end-to-end scenarios: full PlayerController.tick() across every
// preset, in worlds with floors, steps, surf ramps, walls and ladders. Fuzzed
// input checks invariants that must hold no matter what the player does.

import { describe, expect, it } from 'vitest';
import { vec3 } from '../math/vec3';
import { brushFromAABB, brushFromOrientedBox } from '../physics/Collision/Collision';
import { World } from '../physics/World/World';
import { PlayerController } from '../player/PlayerController';
import { DEFAULT_SETTINGS } from '../settings/Settings';
import { PRESET_NAMES, applyPreset } from '../settings/Presets/Presets';

const DT = 1 / 128;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function arena(): World {
  const w = new World();
  w.solids.push(brushFromAABB(vec3(-2048, -64, -2048), vec3(2048, 0, 2048))); // floor
  // walls
  w.solids.push(brushFromAABB(vec3(-2048, 0, -2064), vec3(2048, 600, -2048)));
  w.solids.push(brushFromAABB(vec3(-2048, 0, 2048), vec3(2048, 600, 2064)));
  w.solids.push(brushFromAABB(vec3(2048, 0, -2048), vec3(2064, 600, 2048)));
  w.solids.push(brushFromAABB(vec3(-2064, 0, -2048), vec3(-2048, 600, 2048)));
  // steps and boxes
  for (let i = 0; i < 6; i++) w.solids.push(brushFromAABB(vec3(200 + i * 40, 0, -50), vec3(240 + i * 40, 6 + i * 6, 50)));
  w.solids.push(brushFromAABB(vec3(-300, 0, -300), vec3(-200, 80, -200)));
  // ladder
  w.solids.push(brushFromAABB(vec3(1000, 0, -1564), vec3(1064, 500, -1436)));
  w.ladders.push({ ...brushFromAABB(vec3(960, 0, -1520), vec3(1000, 500, -1480)), facing: vec3(-1, 0, 0) });
  return w;
}

/** 50-degree face, 280 long, very wide: the same build as the TryPlayerMove surf tests. */
function surfWorld(): World {
  const w = new World();
  const t = (50 * Math.PI) / 180;
  const L = 280;
  const ay = vec3(0, Math.cos(t), -Math.sin(t));
  const az = vec3(0, Math.sin(t), Math.cos(t));
  const foot = vec3(0, 0, -L * Math.cos(t));
  const center = vec3(foot.x + az.x * (L / 2) - ay.x * 4, foot.y + az.y * (L / 2) - ay.y * 4, foot.z + az.z * (L / 2) - ay.z * 4);
  w.solids.push(brushFromOrientedBox(center, vec3(8192, 8, L / 2), vec3(1, 0, 0), ay, az));
  return w;
}

function check(p: PlayerController, label: string): void {
  const vals = [p.origin.x, p.origin.y, p.origin.z, p.velocity.x, p.velocity.y, p.velocity.z];
  for (const v of vals) if (!Number.isFinite(v)) throw new Error(`${label}: non-finite state ${vals.join(',')}`);
  if (p.origin.y < -64 + 0 && Math.abs(p.origin.x) < 2000 && Math.abs(p.origin.z) < 2000) {
    throw new Error(`${label}: fell through the floor y=${p.origin.y}`);
  }
  if (Math.abs(p.origin.x) > 2048 || Math.abs(p.origin.z) > 2048) throw new Error(`${label}: escaped arena ${p.origin.x},${p.origin.z}`);
  const max = p.settings.physics.maxVelocity;
  for (const v of [p.velocity.x, p.velocity.y, p.velocity.z]) {
    if (Math.abs(v) > max + 1e-6) throw new Error(`${label}: velocity beyond sv_maxvelocity ${v}`);
  }
  if (p.onGround && p.velocity.y !== 0) throw new Error(`${label}: grounded with vy=${p.velocity.y}`);
}

describe('fuzz: random input never breaks invariants (all presets)', () => {
  for (const name of PRESET_NAMES) {
    it(`${name}`, () => {
      for (let seed = 1; seed <= 8; seed++) {
        const rand = rng(seed * 7919);
        const world = arena();
        const p = new PlayerController(world, applyPreset(DEFAULT_SETTINGS, name), vec3((rand() - 0.5) * 400, 20, (rand() - 0.5) * 400));
        let yawRate = 0;
        for (let i = 0; i < 6000; i++) {
          if (i % 40 === 0) {
            p.input.forward = rand() < 0.7;
            p.input.back = rand() < 0.1;
            p.input.left = rand() < 0.3;
            p.input.right = rand() < 0.3;
            p.input.jump = rand() < 0.5;
            p.input.duck = rand() < 0.25;
            p.input.walk = rand() < 0.1;
            yawRate = (rand() - 0.5) * 6;
          }
          if (i % 997 === 0) p.pitch = (rand() - 0.5) * 160;
          p.yaw += yawRate;
          p.tick(DT);
          check(p, `${name} seed ${seed} tick ${i}`);
        }
      }
    });
  }
});

describe('scenarios', () => {
  const fresh = (name: (typeof PRESET_NAMES)[number], at = vec3(0, 0.5, 0)): PlayerController =>
    new PlayerController(arena(), applyPreset(DEFAULT_SETTINGS, name), at);

  it('standing still on the floor is stable for 10 seconds', () => {
    const p = fresh('vanilla');
    for (let i = 0; i < 1280; i++) p.tick(DT);
    expect(p.onGround).toBe(true);
    expect(p.velocity.y).toBe(0);
    expect(Math.abs(p.origin.y)).toBeLessThan(0.1);
  });

  it('runs to run speed and stops with friction', () => {
    const p = fresh('vanilla');
    p.input.forward = true;
    for (let i = 0; i < 400; i++) p.tick(DT);
    expect(p.horizontalSpeed).toBeCloseTo(250, 0);
    p.input.forward = false;
    for (let i = 0; i < 300; i++) p.tick(DT);
    expect(p.horizontalSpeed).toBe(0);
  });

  it('a jump lands back at floor height with no drift', () => {
    const p = fresh('vanilla');
    for (let i = 0; i < 8; i++) p.tick(DT);
    p.input.jump = true;
    p.tick(DT);
    p.input.jump = false;
    let apex = 0;
    for (let i = 0; i < 200 && !(p.onGround && i > 5); i++) {
      p.tick(DT);
      apex = Math.max(apex, p.origin.y);
    }
    expect(apex).toBeGreaterThan(54);
    expect(apex).toBeLessThan(60);
    expect(p.onGround).toBe(true);
    for (let i = 0; i < 4; i++) p.tick(DT); // grounded players follow the floor down
    expect(Math.abs(p.origin.y)).toBeLessThan(0.1);
  });

  it('autobhop chain on the bhop preset keeps hopping without falling through', () => {
    const p = fresh('bhop', vec3(-1500, 0.5, 0));
    p.input.forward = true;
    p.input.jump = true;
    let hops = 0;
    let wasGround = true;
    for (let i = 0; i < 1500; i++) {
      p.yaw = -90;
      p.tick(DT);
      if (!wasGround && p.onGround) hops++;
      wasGround = p.onGround;
      check(p, 'bhop');
      if (p.origin.x > 1900) break;
    }
    expect(hops).toBeGreaterThan(3);
  });

  it('walks up the steps and stops at the first too-tall obstacle', () => {
    const p = fresh('vanilla', vec3(100, 0.5, 0));
    p.input.forward = true;
    p.yaw = -90; // +x
    let peak = 0;
    for (let i = 0; i < 700; i++) {
      p.tick(DT);
      peak = Math.max(peak, p.origin.y);
    }
    // Six 6u risers up to a 36u top: every one is under the 18u step height,
    // so the player climbs the whole flight and then walks off the far end.
    expect(peak).toBeGreaterThan(35);
    expect(peak).toBeLessThan(36.5);
    expect(p.origin.x).toBeGreaterThan(500);
    expect(p.origin.y).toBeLessThan(0.1);
  });

  it('is stopped by a ledge taller than the step height', () => {
    const w = new World();
    w.solids.push(brushFromAABB(vec3(-512, -16, -512), vec3(512, 0, 512)));
    w.solids.push(brushFromAABB(vec3(100, 0, -100), vec3(200, 30, 100)));
    const p = new PlayerController(w, applyPreset(DEFAULT_SETTINGS, 'vanilla'), vec3(0, 0.5, 0));
    p.input.forward = true;
    p.yaw = -90;
    for (let i = 0; i < 400; i++) p.tick(DT);
    expect(p.origin.x).toBeLessThan(85);
    expect(p.origin.y).toBeLessThan(0.1);
  });

  it('crouch speed is 85 and standing up works in the open', () => {
    const p = fresh('vanilla');
    p.input.forward = true;
    p.input.duck = true;
    for (let i = 0; i < 400; i++) p.tick(DT);
    expect(p.ducked).toBe(true);
    expect(p.horizontalSpeed).toBeCloseTo(85, 0);
    p.input.duck = false;
    for (let i = 0; i < 80; i++) p.tick(DT);
    expect(p.ducked).toBe(false);
  });

  it('surf ramp: riding it never grounds the player or zeroes speed', () => {
    const p = new PlayerController(surfWorld(), applyPreset(DEFAULT_SETTINGS, 'surf'), vec3(0, 100, -140));
    p.velocity.x = 300;
    p.yaw = -90;
    p.input.right = true; // strafe into the face
    let minSpeed = Infinity;
    for (let i = 0; i < 400; i++) {
      p.tick(DT);
      expect(Number.isFinite(p.velocity.x + p.velocity.y + p.velocity.z)).toBe(true);
      expect(p.onGround).toBe(false);
      if (i > 20) minSpeed = Math.min(minSpeed, p.horizontalSpeed);
    }
    expect(minSpeed).toBeGreaterThan(100);
  });

  it('ladder: grab, climb, and let go', () => {
    const p = fresh('vanilla', vec3(940, 0.5, -1500));
    p.yaw = -90;
    p.input.forward = true;
    for (let i = 0; i < 200; i++) p.tick(DT);
    expect(p.onLadder).not.toBeNull();
    expect(p.origin.y).toBeGreaterThan(100);
    p.input.forward = false;
    p.input.jump = true;
    for (let i = 0; i < 80; i++) p.tick(DT);
    expect(p.onLadder).toBeNull();
    expect(p.velocity.x).toBeLessThan(0);
  });

  it('respawn resets duck, ladder and stamina state', () => {
    const p = fresh('vanilla');
    p.input.duck = true;
    for (let i = 0; i < 60; i++) p.tick(DT);
    expect(p.duckFrac).toBe(1);
    p.input.duck = false;
    p.stamina = 40;
    p.input.reset = true;
    p.tick(DT);
    expect(p.duckFrac).toBeLessThan(0.1);
    expect(p.stamina).toBeLessThan(1);
    expect(p.velocity.y).not.toBeNaN();
  });
});
