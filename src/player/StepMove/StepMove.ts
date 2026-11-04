/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { STANDABLE_NORMAL } from '../../constants.js';
import { copy, set, vec3 } from '../../math/vec3.js';
import { DIST_EPSILON } from '../../physics/Collision/Collision.config.js';
import type { MovementContext } from '../MovementContext.js';
import { tryPlayerMove } from '../TryPlayerMove/TryPlayerMove.js';
import { STEP_HEIGHT } from './StepMove.config.js';

// Scratch snapshots, reused every call (stepMove is not re-entrant).
const startOrigin = vec3();
const startVel = vec3();
const downOrigin = vec3();
const downVel = vec3();

/**
 * Source's StepMove: run the move directly, then again with an 18-unit
 * step-up first; keep whichever version travelled farther horizontally.
 * Both the step up and the step back down reach STEP_HEIGHT + DIST_EPSILON.
 */
export function stepMove(ctx: MovementContext, dt: number): void {
  copy(startOrigin, ctx.origin);
  copy(startVel, ctx.velocity);

  // Attempt 1: direct.
  tryPlayerMove(ctx, dt);
  copy(downOrigin, ctx.origin);
  copy(downVel, ctx.velocity);

  // Attempt 2: up, move, down.
  copy(ctx.origin, startOrigin);
  copy(ctx.velocity, startVel);
  let tr = ctx.world.trace(
    ctx.origin,
    set(ctx.tmpA, ctx.origin.x, ctx.origin.y + STEP_HEIGHT + DIST_EPSILON, ctx.origin.z),
    ctx.mins,
    ctx.maxs,
    ctx.traceResult,
  );
  if (!tr.startSolid && !tr.allSolid) copy(ctx.origin, tr.endPos);

  tryPlayerMove(ctx, dt);

  tr = ctx.world.trace(
    ctx.origin,
    set(ctx.tmpA, ctx.origin.x, ctx.origin.y - STEP_HEIGHT - DIST_EPSILON, ctx.origin.z),
    ctx.mins,
    ctx.maxs,
    ctx.traceResult,
  );
  // Landing on nothing, or on something too steep to stand on, means the
  // stepped path isn't a real step: keep the direct attempt. (Source tests
  // plane.normal.z < 0.7, which is also true for a trace that hit nothing.)
  const noFooting = tr.normal === null || tr.normal.y < STANDABLE_NORMAL;
  if (!tr.startSolid && !tr.allSolid && !noFooting) {
    copy(ctx.origin, tr.endPos);
  }

  if (noFooting) {
    copy(ctx.origin, downOrigin);
    copy(ctx.velocity, downVel);
    return;
  }

  const dxUp = ctx.origin.x - startOrigin.x;
  const dzUp = ctx.origin.z - startOrigin.z;
  const dxDown = downOrigin.x - startOrigin.x;
  const dzDown = downOrigin.z - startOrigin.z;
  if (dxDown * dxDown + dzDown * dzDown > dxUp * dxUp + dzUp * dzUp) {
    copy(ctx.origin, downOrigin);
    copy(ctx.velocity, downVel);
  } else {
    // Keep the stepped result but take the direct move's vertical velocity,
    // as Source does.
    ctx.velocity.y = downVel.y;
  }
}
