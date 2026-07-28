/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { set, vec3 } from '../../math/vec3.js';
import type { MovementContext } from '../MovementContext.js';
import { HULL_DUCK_HEIGHT, HULL_HALF_WIDTH, HULL_STAND_HEIGHT } from './Duck.config.js';

export const STAND_MINS = vec3(-HULL_HALF_WIDTH, 0, -HULL_HALF_WIDTH);
export const STAND_MAXS = vec3(HULL_HALF_WIDTH, HULL_STAND_HEIGHT, HULL_HALF_WIDTH);
export const DUCK_MINS = vec3(-HULL_HALF_WIDTH, 0, -HULL_HALF_WIDTH);
export const DUCK_MAXS = vec3(HULL_HALF_WIDTH, HULL_DUCK_HEIGHT, HULL_HALF_WIDTH);

function tryUnduck(ctx: MovementContext): void {
  if (ctx.onGround) {
    if (ctx.world.isPositionFree(ctx.origin, STAND_MINS, STAND_MAXS)) {
      ctx.ducked = false;
    }
    return;
  }
  // In air: put the feet back down if there's room, else stand in place.
  const delta = HULL_STAND_HEIGHT - HULL_DUCK_HEIGHT;
  set(ctx.tmpA, ctx.origin.x, ctx.origin.y - delta, ctx.origin.z);
  if (ctx.world.isPositionFree(ctx.tmpA, STAND_MINS, STAND_MAXS)) {
    ctx.origin.y -= delta;
    ctx.ducked = false;
  } else if (ctx.world.isPositionFree(ctx.origin, STAND_MINS, STAND_MAXS)) {
    ctx.ducked = false;
  }
}

export function updateDuck(ctx: MovementContext): void {
  const want = ctx.input.duck;
  if (want && !ctx.ducked) {
    ctx.ducked = true;
    if (!ctx.onGround) {
      // In-air duck pulls the feet up so the head stays put (lets you duck
      // onto ledges, as in CS).
      const delta = HULL_STAND_HEIGHT - HULL_DUCK_HEIGHT;
      set(ctx.tmpA, ctx.origin.x, ctx.origin.y + delta, ctx.origin.z);
      if (ctx.world.isPositionFree(ctx.tmpA, DUCK_MINS, DUCK_MAXS)) {
        ctx.origin.y += delta;
      }
    }
  } else if (!want && ctx.ducked) {
    tryUnduck(ctx);
  }
}
