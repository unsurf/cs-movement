/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { STANDABLE_NORMAL } from '../../constants.js';
import { clone, copy, set } from '../../math/vec3.js';
import type { MovementContext } from '../MovementContext.js';
import { tryPlayerMove } from '../TryPlayerMove/TryPlayerMove.js';
import { STEP_HEIGHT } from './StepMove.config.js';

/**
 * Source's StepMove: run the move directly, then again with an 18-unit
 * step-up first; keep whichever version travelled farther horizontally.
 */
export function stepMove(ctx: MovementContext, dt: number): void {
  const startOrigin = clone(ctx.origin);
  const startVel = clone(ctx.velocity);

  // Attempt 1: direct.
  tryPlayerMove(ctx, dt);
  const downOrigin = clone(ctx.origin);
  const downVel = clone(ctx.velocity);

  // Attempt 2: up, move, down.
  copy(ctx.origin, startOrigin);
  copy(ctx.velocity, startVel);
  let tr = ctx.world.trace(
    ctx.origin,
    set(ctx.tmpA, ctx.origin.x, ctx.origin.y + STEP_HEIGHT, ctx.origin.z),
    ctx.mins,
    ctx.maxs,
  );
  if (!tr.startSolid && !tr.allSolid) copy(ctx.origin, tr.endPos);

  tryPlayerMove(ctx, dt);

  tr = ctx.world.trace(
    ctx.origin,
    set(ctx.tmpA, ctx.origin.x, ctx.origin.y - STEP_HEIGHT, ctx.origin.z),
    ctx.mins,
    ctx.maxs,
  );
  const steppedOntoSteep = tr.fraction < 1 && tr.normal !== null && tr.normal.y < STANDABLE_NORMAL;
  if (!tr.startSolid && !tr.allSolid && !steppedOntoSteep) {
    copy(ctx.origin, tr.endPos);
  }

  if (steppedOntoSteep) {
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
