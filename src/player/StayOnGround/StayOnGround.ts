/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { STANDABLE_NORMAL } from '../../constants.js';
import { copy, set } from '../../math/vec3.js';
import { STEP_HEIGHT } from '../StepMove/StepMove.config.js';
import type { MovementContext } from '../MovementContext.js';

/** Keep grounded players glued to walkable slopes (Source's StayOnGround). */
export function stayOnGround(ctx: MovementContext): void {
  const tr = ctx.world.trace(
    ctx.origin,
    set(ctx.tmpA, ctx.origin.x, ctx.origin.y - STEP_HEIGHT, ctx.origin.z),
    ctx.mins,
    ctx.maxs,
  );
  if (tr.fraction > 0 && tr.fraction < 1 && !tr.startSolid && tr.normal !== null && tr.normal.y >= STANDABLE_NORMAL) {
    copy(ctx.origin, tr.endPos);
  }
}
