// State, stepping and event API: snapshot/restore determinism, fixed-step
// advance(), teleport/respawn resets, analog input and movement events.

import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { brushFromAABB } from '../../physics/Collision/Collision';
import { World } from '../../physics/World/World';
import { DEFAULT_SETTINGS } from '../../settings/Settings';
import { PlayerController } from '../PlayerController';
import type { MovementEvent } from '../MovementEvents/MovementEvents.types';
import type { InterpolatedPose } from '../FixedStep/FixedStep.types';

const DT = 1 / DEFAULT_SETTINGS.tickRate;

function world(): World {
  const w = new World();
  w.solids.push(brushFromAABB(vec3(-4096, -64, -4096), vec3(4096, 0, 4096)));
  w.ladders.push({ ...brushFromAABB(vec3(460, 0, -20), vec3(500, 500, 20)), facing: vec3(-1, 0, 0) });
  return w;
}

function player(opts: ConstructorParameters<typeof PlayerController>[3] = {}): PlayerController {
  return new PlayerController(world(), structuredClone(DEFAULT_SETTINGS), vec3(0, 0.5, 0), opts);
}

function script(p: PlayerController, tick: number): void {
  p.yaw = Math.sin(tick / 40) * 60;
  p.input.forward = tick % 97 < 80;
  p.input.right = tick % 53 < 20;
  p.input.jump = tick % 61 < 30;
  p.input.duck = tick % 149 < 15;
}

describe('snapshot / restore', () => {
  it('survives JSON and continues bit-identically', () => {
    const a = player();
    for (let t = 0; t < 300; t++) {
      script(a, t);
      a.tick(DT);
    }
    const saved = JSON.parse(JSON.stringify(a.snapshot()));
    const b = player();
    b.restore(saved);
    for (let t = 300; t < 700; t++) {
      script(a, t);
      script(b, t);
      a.tick(DT);
      b.tick(DT);
    }
    expect(b.snapshot()).toEqual(a.snapshot());
  });

  it('restores an in-progress ladder grip by index', () => {
    const a = player();
    a.teleport(vec3(440, 0.5, 0));
    a.yaw = -90;
    a.input.forward = true;
    for (let i = 0; i < 100; i++) a.tick(DT);
    expect(a.onLadder).not.toBeNull();
    const snap = a.snapshot();
    expect(snap.ladderIndex).toBe(0);
    const b = player();
    b.restore(snap);
    expect(b.onLadder).toBe(b.world.ladders[0]);
  });
});

describe('advance / interpolate', () => {
  it('simulates fixed ticks regardless of frame time, carrying the remainder', () => {
    const p = player();
    let ticks = 0;
    for (let i = 0; i < 60; i++) ticks += p.advance(1 / 60).ticks;
    expect(ticks).toBe(128); // exactly one second of 1/128 ticks
  });

  it('is frame-rate independent', () => {
    const run = (frame: number): PlayerController => {
      const p = player();
      p.input.forward = true;
      for (let t = 0; t < 2 / frame; t++) p.advance(frame);
      return p;
    };
    const a = run(1 / 30);
    const b = run(1 / 144);
    expect(Math.abs(a.horizontalSpeed - b.horizontalSpeed)).toBeLessThan(1);
  });

  it('clamps huge frames to MAX_FRAME_TIME', () => {
    const p = player();
    expect(p.advance(5).ticks).toBeLessThanOrEqual(13);
  });

  it('interpolates between the last two ticks', () => {
    const p = player();
    p.input.forward = true;
    p.yaw = 0;
    for (let i = 0; i < 60; i++) p.tick(DT);
    const out: InterpolatedPose = { x: 0, y: 0, z: 0, eyeHeight: 0 };
    p.interpolate(0, out);
    expect(out.z).toBeCloseTo(p.prevPos.z, 9);
    p.interpolate(1, out);
    expect(out.z).toBeCloseTo(p.currPos.z, 9);
    p.interpolate(0.5, out);
    expect(out.z).toBeCloseTo((p.prevPos.z + p.currPos.z) / 2, 9);
  });
});

describe('teleport / respawn', () => {
  it('clears fall, jump and stuck history so a mid-fall respawn lands clean', () => {
    const p = player();
    p.teleport(vec3(0, 600, 0));
    for (let i = 0; i < 40; i++) p.tick(DT);
    expect(p.fallVelocity).toBeGreaterThan(0);
    p.input.jump = true;
    p.oldJump = true;
    p.respawn();
    expect(p.fallVelocity).toBe(0);
    expect(p.oldJump).toBe(false);
    expect(p.time).toBe(0);
    expect(p.landPunch).toBe(0);
    expect(p.velocity.y).toBe(0);
  });

  it('teleports to a new spot with a given velocity and heading', () => {
    const p = player();
    p.teleport(vec3(100, 50, 100), { velocity: vec3(10, 0, 0), yaw: 90 });
    expect(p.origin).toEqual(vec3(100, 50, 100));
    expect(p.velocity.x).toBe(10);
    expect(p.yaw).toBe(90);
    expect(p.currPos).toEqual(p.origin);
  });

  it('setSpawn moves where respawn() returns to', () => {
    const p = player();
    p.setSpawn(vec3(10, 0.5, 10));
    p.respawn();
    expect(p.origin.x).toBe(10);
    expect(p.origin.z).toBe(10);
  });
});

describe('analog input', () => {
  it('half deflection reaches half wishspeed', () => {
    const p = player();
    p.input.forwardMove = 0.5;
    for (let i = 0; i < 400; i++) p.tick(DT);
    expect(p.horizontalSpeed).toBeCloseTo(DEFAULT_SETTINGS.runSpeed * 0.5, 0);
  });

  it('null axes fall back to the keys', () => {
    const p = player();
    p.input.forward = true;
    for (let i = 0; i < 400; i++) p.tick(DT);
    expect(p.horizontalSpeed).toBeCloseTo(DEFAULT_SETTINGS.runSpeed, 0);
  });

  it('canMove=false also ignores the analog axes', () => {
    const p = player();
    p.canMove = false;
    p.input.forwardMove = 1;
    for (let i = 0; i < 100; i++) p.tick(DT);
    expect(p.horizontalSpeed).toBe(0);
    expect(p.input.forwardMove).toBe(1);
  });
});

describe('events', () => {
  it('reports jump, land, duck/unduck, ladder enter/exit and teleport', () => {
    const events: MovementEvent[] = [];
    const p = player({ onEvent: (e) => events.push(e) });
    const types = (): string[] => events.map((e) => e.type);

    for (let i = 0; i < 10; i++) p.tick(DT);
    p.input.jump = true;
    p.tick(DT);
    p.input.jump = false;
    for (let i = 0; i < 128; i++) p.tick(DT);
    expect(types()).toContain('jump');
    expect(types()).toContain('land');
    const jump = events.find((e) => e.type === 'jump');
    expect(jump && jump.type === 'jump' && jump.speed).toBe(0);

    p.input.duck = true;
    for (let i = 0; i < 100; i++) p.tick(DT);
    p.input.duck = false;
    for (let i = 0; i < 100; i++) p.tick(DT);
    expect(types()).toContain('duck');
    expect(types()).toContain('unduck');

    p.teleport(vec3(440, 0.5, 0));
    p.yaw = -90;
    p.input.forward = true;
    for (let i = 0; i < 100; i++) p.tick(DT);
    p.input.forward = false;
    p.input.jump = true;
    for (let i = 0; i < 40; i++) p.tick(DT);
    expect(types()).toContain('teleport');
    expect(types()).toContain('ladderEnter');
    expect(types()).toContain('ladderExit');
  });

  it('landing reports fall speed', () => {
    const events: MovementEvent[] = [];
    const p = player({ onEvent: (e) => events.push(e) });
    p.teleport(vec3(0, 300, 0));
    for (let i = 0; i < 400; i++) p.tick(DT);
    const land = events.find((e) => e.type === 'land');
    expect(land && land.type === 'land' && land.fallSpeed).toBeGreaterThan(400);
  });
});
