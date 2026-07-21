/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Vec3 } from '../../math/vec3.js';
import { traceBox, boxInBrush } from '../Collision/Collision.js';
import type { Brush, LadderVolume, TraceResult } from '../Collision/Collision.types.js';

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
