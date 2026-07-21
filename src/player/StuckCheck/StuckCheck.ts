/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { copy, set } from '../../math/vec3.js';
import type { MovementContext } from '../MovementContext.js';

const DIRS: Array<[number, number, number]> = [
  [0, 1, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 0, 1],
  [0, 0, -1],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, -1, 0],
];

/**
 * Source-style CheckStuck: if the hull starts a tick overlapping solid
 * (possible where brushes overlap, e.g. Λ ramp ridges), nudge it out to the
 * nearest free spot instead of letting the move pipeline grind against
 * geometry it's inside of. Returns true only when hopelessly wedged (then
 * we also kill velocity so gravity can't pump it while pinned).
 */
export function checkStuck(ctx: MovementContext): boolean {
  if (ctx.world.isPositionFree(ctx.origin, ctx.mins, ctx.maxs)) {
    ctx.stuckTicks = 0;
    return false;
  }

  for (const dist of [1, 2, 4, 8, 16, 34]) {
    for (const [dx, dy, dz] of DIRS) {
      set(ctx.tmpA, ctx.origin.x + dx * dist, ctx.origin.y + dy * dist, ctx.origin.z + dz * dist);
      if (ctx.world.isPositionFree(ctx.tmpA, ctx.mins, ctx.maxs)) {
        if (ctx.stuckTicks === 0) {
          ctx.log(
            `unstuck: popped ${dist}u (${dx},${dy},${dz}) from ` +
              `(${ctx.origin.x.toFixed(1)}, ${ctx.origin.y.toFixed(1)}, ${ctx.origin.z.toFixed(1)})`,
          );
        }
        copy(ctx.origin, ctx.tmpA);
        ctx.stuckTicks = 0;
        return false;
      }
    }
  }

  if (ctx.stuckTicks % 128 === 0) {
    ctx.log(
      `STUCK: no free spot near (${ctx.origin.x.toFixed(1)}, ${ctx.origin.y.toFixed(1)}, ` +
        `${ctx.origin.z.toFixed(1)}) — velocity zeroed (press R to respawn)`,
    );
  }
  ctx.stuckTicks++;
  set(ctx.velocity, 0, 0, 0);
  return true;
}
