/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { GRAVITY } from '../../constants.js';
import { length2D } from '../../math/vec3.js';
import { airAccelerate } from '../../physics/AirAccelerate/AirAccelerate.js';
import { currentMaxSpeed } from '../CurrentMaxSpeed/CurrentMaxSpeed.js';
import type { MovementContext } from '../MovementContext.js';
import { tryPlayerMove } from '../TryPlayerMove/TryPlayerMove.js';
import { computeWish } from '../WishDir/WishDir.js';

export function airMove(ctx: MovementContext, dt: number): void {
  const wishspeed = computeWish(ctx);
  // "nopre" bans ordinary air-strafe speed gain (pumping off a ledge, in a
  // bhop chain, ...), but surfing legitimately depends on exceeding ground
  // max speed while riding a ramp — that's not "prestrafe", it's the whole
  // point of surf, so it's exempt. ctx.surfing reflects last tick's contact,
  // the same one-tick lag stepMove/categorizePosition already rely on.
  const capActive = ctx.settings.noPrestrafe && !ctx.surfing;
  // Remember speed going in, so the cap below can never claw back speed the
  // player already legitimately had (a bhop chain, a perf-bonus takeoff) —
  // it only stops airAccelerate from adding MORE on top of it.
  const speedBefore = capActive ? length2D(ctx.velocity) : 0;

  airAccelerate(ctx.velocity, ctx.wishDir, wishspeed, ctx.settings.airAccelerate, dt);

  if (capActive) {
    const cap = Math.max(speedBefore, currentMaxSpeed(ctx));
    const speedAfter = length2D(ctx.velocity);
    if (speedAfter > cap) {
      const scale = cap / speedAfter;
      ctx.velocity.x *= scale;
      ctx.velocity.z *= scale;
    }
  }

  ctx.velocity.y -= 0.5 * GRAVITY * dt; // half gravity before the move
  tryPlayerMove(ctx, dt);
  ctx.velocity.y -= 0.5 * GRAVITY * dt; // half gravity after
}
