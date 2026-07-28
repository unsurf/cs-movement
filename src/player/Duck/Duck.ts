/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { length2D, vec3 } from '../../math/vec3.js';
import type { MovementContext } from '../MovementContext.js';
import {
  DUCK_LANDING_BONUS,
  HULL_DUCK_HEIGHT,
  HULL_HALF_WIDTH,
  HULL_STAND_HEIGHT,
} from './Duck.config.js';

export const STAND_MINS = vec3(-HULL_HALF_WIDTH, 0, -HULL_HALF_WIDTH);
export const STAND_MAXS = vec3(HULL_HALF_WIDTH, HULL_STAND_HEIGHT, HULL_HALF_WIDTH);
export const DUCK_MINS = vec3(-HULL_HALF_WIDTH, 0, -HULL_HALF_WIDTH);
export const DUCK_MAXS = vec3(HULL_HALF_WIDTH, HULL_DUCK_HEIGHT, HULL_HALF_WIDTH);

function tryUnduck(ctx: MovementContext): void {
  if (ctx.world.isPositionFree(ctx.origin, STAND_MINS, STAND_MAXS)) {
    ctx.ducked = false;
  }
}

/**
 * See DUCK_LANDING_BONUS: a labeled, non-SDK-derived approximation of
 * CS:GO's real duck-jump distance credit (real Source's SetDuckedEyeOffset
 * only ever writes the view/camera offset, never the origin — nothing in
 * the shared SDK produces this from ducking, so it can't be reverse
 * engineered, only approximated). Applied once per flight regardless of
 * when duck first engages — timing-invariant by construction, matching real
 * play (a duck-jump reads the same distance whether duck was already held
 * before takeoff, pressed the same tick as jump, or pressed mid-air).
 * Nudges origin along the current horizontal velocity direction; a jump
 * with no horizontal velocity (straight up) has no direction to credit and
 * gets nothing. Two call sites: Jump.ts (duck already active the instant a
 * grounded jump fires) and updateDuck below (duck first pressed after
 * already airborne).
 */
export function applyDuckLandingBonus(ctx: MovementContext): void {
  if (ctx.duckBonusAppliedThisFlight) return;
  ctx.duckBonusAppliedThisFlight = true;
  const speed = length2D(ctx.velocity);
  if (speed <= 0) return;
  const inv = DUCK_LANDING_BONUS / speed;
  ctx.origin.x += ctx.velocity.x * inv;
  ctx.origin.z += ctx.velocity.z * inv;
}

/**
 * Real Source's SetDuckedEyeOffset only ever writes the view/camera offset —
 * it never touches the player's origin. And the default hull mins are
 * identical standing vs ducked (VEC_HULL_MIN == VEC_DUCK_HULL_MIN), so
 * ducking only lowers the hull's top (maxs), not its feet. Ducking therefore
 * has no effect on ground-collision timing: ducking mid-air does not change
 * a jump's distance in real Source. An earlier revision of this file raised
 * origin.y on duck (and lowered it back on unduck) to simulate "feet stay
 * fixed, head drops" — that mechanic doesn't exist in Source and was
 * removed; the smaller hull can still let you duck onto/under things your
 * standing hull wouldn't fit into, purely because your same, unaltered
 * trajectory now fits a shorter box.
 */
export function updateDuck(ctx: MovementContext): void {
  const want = ctx.input.duck;
  if (want && !ctx.ducked) {
    ctx.ducked = true;
    if (!ctx.onGround) applyDuckLandingBonus(ctx);
  } else if (!want && ctx.ducked) {
    tryUnduck(ctx);
  }
}
