/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { set, vec3 } from '../../math/vec3.js';
import type { MovementContext } from '../MovementContext.js';
import { DUCK_LERP_TIME, HULL_DUCK_HEIGHT, HULL_HALF_WIDTH, HULL_STAND_HEIGHT } from './Duck.config.js';

export const STAND_MINS = vec3(-HULL_HALF_WIDTH, 0, -HULL_HALF_WIDTH);
export const STAND_MAXS = vec3(HULL_HALF_WIDTH, HULL_STAND_HEIGHT, HULL_HALF_WIDTH);
export const DUCK_MINS = vec3(-HULL_HALF_WIDTH, 0, -HULL_HALF_WIDTH);
export const DUCK_MAXS = vec3(HULL_HALF_WIDTH, HULL_DUCK_HEIGHT, HULL_HALF_WIDTH);

const HULL_DELTA = HULL_STAND_HEIGHT - HULL_DUCK_HEIGHT; // 18

function stepDuckFrac(ctx: MovementContext, dt: number, target: number): void {
  const rate = dt / DUCK_LERP_TIME;
  ctx.duckFrac += Math.sign(target - ctx.duckFrac) * Math.min(rate, Math.abs(target - ctx.duckFrac));
}

/**
 * Ground duck stays instant (hull flips the tick you press it, matching
 * CurrentMaxSpeed/friction reading ctx.ducked directly) — there's no hang-time
 * mechanic on the ground for a gradual transition to matter for. duckFrac
 * still ramps for the eye-height lerp, just with no origin consequence.
 *
 * Airborne, ducked flips immediately too (a jump into a gap only tall enough
 * for the duck hull needs the smaller hull the instant duck is pressed), but
 * the origin.y compensation that keeps your head visually in place — "pulls
 * the feet up so the head stays put" — now ramps in gradually over
 * DUCK_LERP_TIME instead of shifting the full 18u in one tick. That matters
 * for real distance: a duck thrown late in a jump only partially completes
 * before landing, buying less extra hang time than one thrown early, which is
 * the actual CS:GO "duck at the very end" longjump technique — not a fixed
 * bonus regardless of when you press it.
 */
export function updateDuck(ctx: MovementContext, dt: number): void {
  const want = ctx.input.duck;

  if (ctx.onGround) {
    if (want && !ctx.ducked) {
      ctx.ducked = true;
    } else if (!want && ctx.ducked && ctx.world.isPositionFree(ctx.origin, STAND_MINS, STAND_MAXS)) {
      ctx.ducked = false;
    }
    stepDuckFrac(ctx, dt, ctx.ducked ? 1 : 0);
    return;
  }

  ctx.ducked = want;
  const target = want ? 1 : 0;
  if (ctx.duckFrac === target) return;

  const rate = dt / DUCK_LERP_TIME;
  const step = Math.sign(target - ctx.duckFrac) * Math.min(rate, Math.abs(target - ctx.duckFrac));
  const originDelta = step * HULL_DELTA;
  set(ctx.tmpA, ctx.origin.x, ctx.origin.y + originDelta, ctx.origin.z);
  const hullMins = want ? DUCK_MINS : STAND_MINS;
  const hullMaxs = want ? DUCK_MAXS : STAND_MAXS;
  if (ctx.world.isPositionFree(ctx.tmpA, hullMins, hullMaxs)) {
    ctx.origin.y += originDelta;
    ctx.duckFrac += step;
  }
  // else: no room to keep moving the compensation this tick — duckFrac holds
  // where it is and tries again next tick, rather than snapping through
  // geometry.
}
