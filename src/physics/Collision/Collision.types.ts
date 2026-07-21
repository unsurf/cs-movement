/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Vec3 } from '../../math/vec3.js';

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
