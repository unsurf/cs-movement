/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 Liam Grant
 * SPDX-License-Identifier: Apache-2.0
 */
// Quake/Source-style collision: the world is a set of convex brushes (plane
// lists), and the player AABB is traced through them by Minkowski-expanding
// each brush's planes by the box extents, then clipping the movement segment
// (same scheme as Source's engine trace / Quake 2's CM_ClipBoxToBrush).
// Pure module — no Three.js imports — so it runs under Vitest in node.

import { DIST_EPSILON } from '../constants';
import { type Vec3, vec3, clone, dot } from '../math/vec3';

export interface Plane {
  normal: Vec3; // outward-facing unit normal
  dist: number; // dot(normal, pointOnPlane); inside iff dot(n, p) <= dist
}

export interface Brush {
  planes: Plane[];
  min: Vec3; // AABB bounds for broadphase
  max: Vec3;
}

export interface LadderVolume extends Brush {
  /** Direction the climbable face points (away from the wall, horizontal). */
  facing: Vec3;
}

export interface TraceResult {
  fraction: number; // 0..1 of the move completed
  endPos: Vec3;
  normal: Vec3 | null; // plane hit, null if fraction === 1
  startSolid: boolean;
  allSolid: boolean;
}

// -- Brush construction -----------------------------------------------------

export function brushFromAABB(min: Vec3, max: Vec3): Brush {
  return {
    planes: [
      { normal: vec3(1, 0, 0), dist: max.x },
      { normal: vec3(-1, 0, 0), dist: -min.x },
      { normal: vec3(0, 1, 0), dist: max.y },
      { normal: vec3(0, -1, 0), dist: -min.y },
      { normal: vec3(0, 0, 1), dist: max.z },
      { normal: vec3(0, 0, -1), dist: -min.z },
    ],
    min: clone(min),
    max: clone(max),
  };
}

/**
 * Oriented box brush from a center, half-extents, and an orthonormal basis
 * (the box's local x/y/z axes in world space). Axis-aligned "bevel" planes
 * from the box's AABB corners are added, as Quake's compiler does, so the
 * plane-expansion trace stays correct near edges of rotated brushes.
 */
export function brushFromOrientedBox(center: Vec3, halfExtents: Vec3, ax: Vec3, ay: Vec3, az: Vec3): Brush {
  const axes: Array<[Vec3, number]> = [
    [ax, halfExtents.x],
    [ay, halfExtents.y],
    [az, halfExtents.z],
  ];

  const planes: Plane[] = [];
  for (const [a, h] of axes) {
    const d = dot(a, center);
    planes.push({ normal: clone(a), dist: d + h });
    planes.push({ normal: vec3(-a.x, -a.y, -a.z), dist: -(d - h) });
  }

  // AABB of the 8 corners.
  const min = vec3(Infinity, Infinity, Infinity);
  const max = vec3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < 8; i++) {
    const sx = i & 1 ? 1 : -1;
    const sy = i & 2 ? 1 : -1;
    const sz = i & 4 ? 1 : -1;
    const cx = center.x + sx * halfExtents.x * ax.x + sy * halfExtents.y * ay.x + sz * halfExtents.z * az.x;
    const cy = center.y + sx * halfExtents.x * ax.y + sy * halfExtents.y * ay.y + sz * halfExtents.z * az.y;
    const cz = center.z + sx * halfExtents.x * ax.z + sy * halfExtents.y * ay.z + sz * halfExtents.z * az.z;
    min.x = Math.min(min.x, cx); min.y = Math.min(min.y, cy); min.z = Math.min(min.z, cz);
    max.x = Math.max(max.x, cx); max.y = Math.max(max.y, cy); max.z = Math.max(max.z, cz);
  }

  // Bevel planes: the AABB's own faces. They contain the box entirely, so
  // they don't change the solid — but after Minkowski expansion they prevent
  // the box trace from snagging false corners on rotated brushes.
  const bevels: Plane[] = [
    { normal: vec3(1, 0, 0), dist: max.x },
    { normal: vec3(-1, 0, 0), dist: -min.x },
    { normal: vec3(0, 1, 0), dist: max.y },
    { normal: vec3(0, -1, 0), dist: -min.y },
    { normal: vec3(0, 0, 1), dist: max.z },
    { normal: vec3(0, 0, -1), dist: -min.z },
  ];
  for (const b of bevels) {
    if (!planes.some((p) => dot(p.normal, b.normal) > 0.999)) planes.push(b);
  }

  return { planes, min, max };
}

// -- Tracing ----------------------------------------------------------------

/** Minkowski expansion: how much a plane's dist grows for a box of mins/maxs. */
function planeOffset(n: Vec3, mins: Vec3, maxs: Vec3): number {
  return (
    (n.x > 0 ? mins.x : maxs.x) * n.x +
    (n.y > 0 ? mins.y : maxs.y) * n.y +
    (n.z > 0 ? mins.z : maxs.z) * n.z
  );
}

function clipBoxToBrush(
  brush: Brush,
  start: Vec3,
  end: Vec3,
  mins: Vec3,
  maxs: Vec3,
  result: TraceResult,
): void {
  let enterFrac = -1;
  let leaveFrac = 1;
  let clipPlane: Plane | null = null;
  let startOut = false;
  let getOut = false;

  for (const p of brush.planes) {
    const dist = p.dist - planeOffset(p.normal, mins, maxs);
    const d1 = dot(p.normal, start) - dist;
    const d2 = dot(p.normal, end) - dist;

    if (d2 > 0) getOut = true;
    if (d1 > 0) startOut = true;
    // Skip if starting in front AND not meaningfully approaching. The last
    // disjunct is the critical robustness guard: a mover resting at exactly
    // epsilon distance with velocity clipped parallel to the plane produces
    // d2 a few ulps below d1 (pure float noise in the endpoint dot product).
    // Without it, that registers as a femto-fraction "hit" on every bump —
    // pinning the mover in place while gravity pumps its velocity, and
    // resetting the clip-plane list so crease handling never engages.
    if (d1 > 0 && (d2 >= DIST_EPSILON || d2 >= d1 || d1 - d2 < 1e-6)) return;
    if (d1 <= 0 && d2 <= 0) continue;

    if (d1 > d2) {
      // Entering the brush through this plane.
      const f = (d1 - DIST_EPSILON) / (d1 - d2);
      if (f > enterFrac) {
        enterFrac = f;
        clipPlane = p;
      }
    } else {
      // Leaving the brush through this plane.
      const f = (d1 + DIST_EPSILON) / (d1 - d2);
      if (f < leaveFrac) leaveFrac = f;
    }
  }

  if (!startOut) {
    result.startSolid = true;
    if (!getOut) result.allSolid = true;
    return;
  }

  if (enterFrac < leaveFrac && enterFrac > -1 && enterFrac < result.fraction) {
    result.fraction = enterFrac < 0 ? 0 : enterFrac;
    result.normal = clipPlane!.normal;
  }
}

export function traceBox(start: Vec3, end: Vec3, mins: Vec3, maxs: Vec3, brushes: Brush[]): TraceResult {
  const result: TraceResult = {
    fraction: 1,
    endPos: clone(end),
    normal: null,
    startSolid: false,
    allSolid: false,
  };

  // Broadphase: sweep AABB of the whole move.
  const pad = 1;
  const sMinX = Math.min(start.x, end.x) + mins.x - pad;
  const sMinY = Math.min(start.y, end.y) + mins.y - pad;
  const sMinZ = Math.min(start.z, end.z) + mins.z - pad;
  const sMaxX = Math.max(start.x, end.x) + maxs.x + pad;
  const sMaxY = Math.max(start.y, end.y) + maxs.y + pad;
  const sMaxZ = Math.max(start.z, end.z) + maxs.z + pad;

  for (const brush of brushes) {
    if (
      brush.min.x > sMaxX || brush.max.x < sMinX ||
      brush.min.y > sMaxY || brush.max.y < sMinY ||
      brush.min.z > sMaxZ || brush.max.z < sMinZ
    ) {
      continue;
    }
    clipBoxToBrush(brush, start, end, mins, maxs, result);
  }

  // Note: startSolid does NOT pin the trace — a start inside one brush still
  // clips against the others (Quake 2 semantics). Escaping an overlapped
  // start is the mover's job (PlayerController.checkStuck), because pinning
  // here freezes the player in place while gravity pumps their velocity.
  if (result.fraction < 1) {
    result.endPos.x = start.x + (end.x - start.x) * result.fraction;
    result.endPos.y = start.y + (end.y - start.y) * result.fraction;
    result.endPos.z = start.z + (end.z - start.z) * result.fraction;
  }
  return result;
}

/** True if a box at `origin` overlaps the (convex) volume. */
export function boxInBrush(origin: Vec3, mins: Vec3, maxs: Vec3, brush: Brush): boolean {
  for (const p of brush.planes) {
    const dist = p.dist - planeOffset(p.normal, mins, maxs);
    if (dot(p.normal, origin) - dist > 0) return false;
  }
  return true;
}

// -- World ------------------------------------------------------------------

export class World {
  solids: Brush[] = [];
  ladders: LadderVolume[] = [];

  trace(start: Vec3, end: Vec3, mins: Vec3, maxs: Vec3): TraceResult {
    return traceBox(start, end, mins, maxs, this.solids);
  }

  /** Can a hull of mins/maxs exist at origin without intersecting the world? */
  isPositionFree(origin: Vec3, mins: Vec3, maxs: Vec3): boolean {
    const tr = traceBox(origin, origin, mins, maxs, this.solids);
    return !tr.startSolid;
  }

  ladderAt(origin: Vec3, mins: Vec3, maxs: Vec3): LadderVolume | null {
    for (const ladder of this.ladders) {
      if (boxInBrush(origin, mins, maxs, ladder)) return ladder;
    }
    return null;
  }
}
