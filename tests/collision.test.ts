import { describe, expect, it } from 'vitest';
import { vec3 } from '../src/math/vec3';
import { brushFromAABB, brushFromOrientedBox, traceBox, boxInBrush } from '../src/physics/Collision';

// Player-sized hull: origin at the feet.
const MINS = vec3(-16, 0, -16);
const MAXS = vec3(16, 72, 16);
const S = Math.SQRT1_2;

describe('traceBox vs AABB brushes', () => {
  const floor = brushFromAABB(vec3(-100, -16, -100), vec3(100, 0, 100));

  it('lands a falling hull on a floor', () => {
    const tr = traceBox(vec3(0, 50, 0), vec3(0, -50, 0), MINS, MAXS, [floor]);
    expect(tr.fraction).toBeGreaterThan(0.49);
    expect(tr.fraction).toBeLessThan(0.5);
    expect(tr.normal!.y).toBe(1);
    // Feet rest at the floor top (plus the trace epsilon).
    expect(tr.endPos.y).toBeGreaterThanOrEqual(0);
    expect(tr.endPos.y).toBeLessThan(0.1);
  });

  it('stops a hull half-width away from a wall', () => {
    const wall = brushFromAABB(vec3(32, 0, -100), vec3(64, 128, 100));
    const tr = traceBox(vec3(0, 10, 0), vec3(64, 10, 0), MINS, MAXS, [wall]);
    expect(tr.normal!.x).toBe(-1);
    // Wall face at x=32, hull half-width 16 => origin stops near x=16.
    expect(tr.endPos.x).toBeGreaterThan(15.8);
    expect(tr.endPos.x).toBeLessThanOrEqual(16);
  });

  it('flags startSolid when beginning inside geometry (Quake 2 semantics)', () => {
    const tr = traceBox(vec3(0, -8, 0), vec3(0, 20, 0), MINS, MAXS, [floor]);
    expect(tr.startSolid).toBe(true);
    // The overlapped brush doesn't block the move; escaping an in-solid
    // start is the mover's job (PlayerController.checkStuck).
    expect(tr.fraction).toBe(1);
  });

  it('misses geometry outside the path', () => {
    const tr = traceBox(vec3(0, 200, 0), vec3(50, 200, 0), MINS, MAXS, [floor]);
    expect(tr.fraction).toBe(1);
    expect(tr.normal).toBeNull();
  });
});

describe('traceBox vs oriented (ramp) brushes', () => {
  // 45° ramp: local y-axis (surface normal) tilted toward -z, up-slope +z.
  const ramp = brushFromOrientedBox(
    vec3(0, 0, 0),
    vec3(50, 8, 100),
    vec3(1, 0, 0),
    vec3(0, S, -S),
    vec3(0, S, S),
  );

  it('hits the sloped face with the tilted normal', () => {
    const tr = traceBox(vec3(0, 100, 0), vec3(0, -50, 0), MINS, MAXS, [ramp]);
    expect(tr.fraction).toBeLessThan(1);
    expect(tr.normal!.y).toBeCloseTo(S, 4);
    expect(tr.normal!.z).toBeCloseTo(-S, 4);
    // Expanded plane: support corner (z=+16) touches where the surface is
    // higher, so the origin rests at y ≈ 16 + 8/cos45 ≈ 27.3.
    expect(tr.endPos.y).toBeCloseTo(27.3, 0);
  });

  it('added axis bevels keep corner hits sane', () => {
    // Falling well past the high edge should still be stopped by the brush
    // (via the AABB bevel plane), not tunnel through.
    const tr = traceBox(vec3(0, 150, 60), vec3(0, 0, 60), MINS, MAXS, [ramp]);
    expect(tr.fraction).toBeLessThan(1);
  });
});

describe('boxInBrush', () => {
  const volume = brushFromAABB(vec3(0, 0, 0), vec3(48, 200, 40));

  it('detects overlap including hull extents', () => {
    expect(boxInBrush(vec3(24, 50, 20), MINS, MAXS, volume)).toBe(true);
    // 10 units outside on x, but the 16-unit half-width still overlaps.
    expect(boxInBrush(vec3(-10, 50, 20), MINS, MAXS, volume)).toBe(true);
    expect(boxInBrush(vec3(-20, 50, 20), MINS, MAXS, volume)).toBe(false);
  });
});
