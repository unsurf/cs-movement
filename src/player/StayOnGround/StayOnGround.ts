/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (cstrike15_src@f82112a, game/shared/gamemovement.cpp): CGameMovement::StayOnGround

import { STANDABLE_NORMAL } from '../../constants.js';
import { copy, set } from '../../math/vec3.js';
import { STEP_HEIGHT } from '../StepMove/StepMove.config.js';
import type { MovementContext } from '../MovementContext.js';
import { MIN_GROUND_SNAP, STAY_ON_GROUND_LIFT } from './StayOnGround.config.js';

/**
 * Keep grounded players glued to walkable slopes. Like Source, first sweep
 * up (so the down-trace starts from a position known not to be embedded),
 * then trace down to STEP_HEIGHT below the ORIGINAL position.
 */
export function stayOnGround(ctx: MovementContext): void {
  const startY = ctx.origin.y;
  const up = ctx.world.trace(
    ctx.origin,
    set(ctx.tmpA, ctx.origin.x, startY + STAY_ON_GROUND_LIFT, ctx.origin.z),
    ctx.mins,
    ctx.maxs,
    ctx.traceResult,
  );
  const safeX = up.endPos.x;
  const safeY = up.endPos.y;
  const safeZ = up.endPos.z;

  const tr = ctx.world.trace(
    set(ctx.tmpB, safeX, safeY, safeZ),
    set(ctx.tmpA, ctx.origin.x, startY - STEP_HEIGHT, ctx.origin.z),
    ctx.mins,
    ctx.maxs,
    ctx.traceResult,
  );
  if (
    tr.fraction > 0 &&
    tr.fraction < 1 &&
    !tr.startSolid &&
    tr.normal !== null &&
    tr.normal.y >= STANDABLE_NORMAL &&
    Math.abs(startY - tr.endPos.y) > MIN_GROUND_SNAP
  ) {
    copy(ctx.origin, tr.endPos);
  }
}
