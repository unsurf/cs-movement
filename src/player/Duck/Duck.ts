/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (cstrike15_src@f82112a, game/shared/cstrike15/cs_gamemovement.cpp):
// CCSGameMovement::Duck / FinishDuck / FinishUnDuck / CanUnduck

import { set, vec3 } from '../../math/vec3.js';
import type { MovementContext } from '../MovementContext.js';
import {
  AIR_DUCK_ORIGIN_SHIFT,
  CROUCH_STUCK_MAX_STEPS,
  HULL_DUCK_HEIGHT,
  HULL_HALF_WIDTH,
  HULL_STAND_HEIGHT,
} from './Duck.config.js';

export const STAND_MINS = vec3(-HULL_HALF_WIDTH, 0, -HULL_HALF_WIDTH);
export const STAND_MAXS = vec3(HULL_HALF_WIDTH, HULL_STAND_HEIGHT, HULL_HALF_WIDTH);
export const DUCK_MINS = vec3(-HULL_HALF_WIDTH, 0, -HULL_HALF_WIDTH);
export const DUCK_MAXS = vec3(HULL_HALF_WIDTH, HULL_DUCK_HEIGHT, HULL_HALF_WIDTH);

/** Airborne = no ground and not gripping a ladder (the only states where duck moves the feet). */
function isAirborne(ctx: MovementContext): boolean {
  return !ctx.onGround && ctx.onLadder === null;
}

/** FixPlayerCrouchStuck(upward): if the new hull is embedded, nudge up 1u at a time (max 36) until free. */
function fixCrouchStuck(ctx: MovementContext): void {
  if (ctx.world.isPositionFree(ctx.origin, ctx.mins, ctx.maxs)) return;
  const startY = ctx.origin.y;
  for (let i = 0; i < CROUCH_STUCK_MAX_STEPS; i++) {
    ctx.origin.y += 1;
    if (ctx.world.isPositionFree(ctx.origin, ctx.mins, ctx.maxs)) return;
  }
  ctx.origin.y = startY; // failed: leave the player where they were
}

/**
 * CanUnduck: the standing hull must fit. On the ground that is the current
 * position; in the air the unduck also drops the feet by 9, so the standing
 * hull has to sweep clear over that whole path.
 */
function canUnduck(ctx: MovementContext): boolean {
  if (!isAirborne(ctx)) return ctx.world.isPositionFree(ctx.origin, STAND_MINS, STAND_MAXS);
  set(ctx.tmpA, ctx.origin.x, ctx.origin.y - AIR_DUCK_ORIGIN_SHIFT, ctx.origin.z);
  const tr = ctx.world.trace(ctx.origin, ctx.tmpA, STAND_MINS, STAND_MAXS, ctx.traceResult);
  return !tr.startSolid && tr.fraction === 1;
}

export function updateDuck(ctx: MovementContext): void {
  const want = ctx.input.duck;
  if (want && !ctx.ducked) {
    // FinishDuck. In the air the feet come up by half the hull-height delta.
    if (isAirborne(ctx)) ctx.origin.y += AIR_DUCK_ORIGIN_SHIFT;
    ctx.ducked = true;
    fixCrouchStuck(ctx);
  } else if (!want && ctx.ducked && canUnduck(ctx)) {
    // FinishUnDuck. If the player can't stand, they simply stay ducked.
    if (isAirborne(ctx)) ctx.origin.y -= AIR_DUCK_ORIGIN_SHIFT;
    ctx.ducked = false;
  }
}
