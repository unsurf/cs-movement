import { it, expect } from 'vitest';
import { vec3 } from '../math/vec3';
import { brushFromAABB, brushFromOrientedBox } from '../physics/Collision/Collision';
import { World } from '../physics/World/World';
import { PlayerController } from '../player/PlayerController';
import { DEFAULT_SETTINGS } from '../settings/Settings';
import { PRESET_NAMES, applyPreset } from '../settings/Presets/Presets';

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/** Traces keep a 1/32u skin off surfaces, so tiny overlaps with bevel planes are expected; anything deeper is a leak. */
const MAX_PENETRATION = 0.05;

/** Depth the hull sits inside the brush it overlaps most (0 when clear). */
function deepestPenetration(p: PlayerController): number {
  let deepest = 0;
  for (const b of p.world.solids) {
    // Plane-expanded hulls over-approximate near the edges of rotated brushes;
    // only a brush whose real bounds touch the hull can really be penetrated.
    if (
      b.min.x > p.origin.x + p.maxs.x || b.max.x < p.origin.x + p.mins.x ||
      b.min.y > p.origin.y + p.maxs.y || b.max.y < p.origin.y + p.mins.y ||
      b.min.z > p.origin.z + p.maxs.z || b.max.z < p.origin.z + p.mins.z
    ) continue;
    let worst = -Infinity;
    for (const pl of b.planes) {
      const off =
        pl.normal.x * (pl.normal.x > 0 ? p.mins.x : p.maxs.x) +
        pl.normal.y * (pl.normal.y > 0 ? p.mins.y : p.maxs.y) +
        pl.normal.z * (pl.normal.z > 0 ? p.mins.z : p.maxs.z);
      const d = pl.normal.x * p.origin.x + pl.normal.y * p.origin.y + pl.normal.z * p.origin.z - (pl.dist - off);
      worst = Math.max(worst, d);
    }
    if (worst <= 0) deepest = Math.max(deepest, -worst);
  }
  return deepest;
}

function randomWorld(r: () => number): World {
  const w = new World();
  w.solids.push(brushFromAABB(vec3(-100000, -64, -100000), vec3(100000, 0, 100000)));
  for (let i = 0; i < 60; i++) {
    const cx = (r() - 0.5) * 2000, cz = (r() - 0.5) * 2000;
    if (Math.abs(cx) < 300 && Math.abs(cz) < 300) continue;
    if (r() < 0.5) w.solids.push(brushFromAABB(vec3(cx, 0, cz), vec3(cx + 20 + r() * 150, 4 + r() * 120, cz + 20 + r() * 150)));
    else {
      const t = (20 + r() * 65) * Math.PI / 180, y = r() * 6.28;
      const ax = vec3(Math.cos(y), 0, -Math.sin(y)), ay = vec3(Math.sin(y) * Math.sin(t), Math.cos(t), Math.cos(y) * Math.sin(t));
      const az = vec3(ay.y * ax.z - ay.z * ax.y, ay.z * ax.x - ay.x * ax.z, ay.x * ax.y - ay.y * ax.x);
      w.solids.push(brushFromOrientedBox(vec3(cx, 60, cz), vec3(120, 8, 120), ax, ay, az));
    }
  }
  return w;
}

it('stress: random worlds, frame times and presets never leak into geometry or blow up', () => {
  const problems: string[] = [];
  for (const name of PRESET_NAMES) for (let seed = 1; seed <= 40; seed++) {
    const r = rng(seed * 104729 + name.length);
    const dts = [1 / 64, 1 / 128, 1 / 100, 1 / 30, 1 / 240];
    const dt = dts[seed % dts.length];
    const settings = applyPreset(DEFAULT_SETTINGS, name);
    if (seed % 5 === 0) settings.stamina.enabled = true;
    const p = new PlayerController(randomWorld(r), settings, vec3(0, 10, 0), { log: () => {} });
    let yawRate = 0;
    for (let i = 0; i < 4000; i++) {
      if (i % 30 === 0) {
        p.input.forward = r() < 0.8; p.input.back = r() < 0.1; p.input.left = r() < 0.4; p.input.right = r() < 0.4;
        p.input.jump = r() < 0.6; p.input.duck = r() < 0.3; p.input.walk = r() < 0.1; yawRate = (r() - 0.5) * 8;
      }
      p.yaw += yawRate; p.tick(dt);
      const v = [p.origin.x, p.origin.y, p.origin.z, p.velocity.x, p.velocity.y, p.velocity.z];
      if (v.some((x) => !Number.isFinite(x))) { problems.push(`${name}/${seed}/${i}: nonfinite`); break; }
      if (p.origin.y < -1) { problems.push(`${name}/${seed}/${i}: below floor y=${p.origin.y.toFixed(2)} dt=${dt}`); break; }
      if (p.onGround && p.velocity.y !== 0) { problems.push(`${name}/${seed}/${i}: grounded vy`); break; }
      const depth = deepestPenetration(p);
      if (depth > MAX_PENETRATION) { problems.push(`${name}/${seed}/${i}: embedded ${depth.toFixed(3)}u at ${p.origin.x.toFixed(1)},${p.origin.y.toFixed(1)},${p.origin.z.toFixed(1)} dt=${dt.toFixed(4)}`); break; }
    }
  }
  expect(problems).toEqual([]);
}, 60_000);
