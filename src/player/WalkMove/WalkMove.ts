/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { length2D, lengthSq, set } from '../../math/vec3.js';
import { accelerate } from '../../physics/Accelerate/Accelerate.js';
import { ACCELERATE } from '../../physics/Accelerate/Accelerate.config.js';
import { applyFriction } from '../../physics/Friction/Friction.js';
import { FRICTION, STOP_SPEED } from '../../physics/Friction/Friction.config.js';
import { currentMaxSpeed } from '../CurrentMaxSpeed/CurrentMaxSpeed.js';
import type { MovementContext } from '../MovementContext.js';
import { stayOnGround } from '../StayOnGround/StayOnGround.js';
import { stepMove } from '../StepMove/StepMove.js';
import { computeWish } from '../WishDir/WishDir.js';

export function walkMove(ctx: MovementContext, dt: number): void {
  ctx.velocity.y = 0;
  applyFriction(ctx.velocity, FRICTION, STOP_SPEED, dt);

  const wishspeed = computeWish(ctx);
  // "nopre" also has to cover ground movement, not just AirMove: continuously
  // turning wishdir while accelerate()'s addspeed check compares against
  // dot(vel, wishdir) rather than |vel| lets ground-strafing gain speed past
  // maxspeed the same way air-strafing does — friction alone doesn't fully
  // suppress it at this codebase's tuning. Same cap, same "never claw back
  // pre-existing speed" rule as AirMove.
  const speedBefore = ctx.settings.noPrestrafe ? length2D(ctx.velocity) : 0;
  accelerate(ctx.velocity, ctx.wishDir, wishspeed, ACCELERATE, dt);
  ctx.velocity.y = 0;

  if (ctx.settings.noPrestrafe) {
    const cap = Math.max(speedBefore, currentMaxSpeed(ctx));
    const speedAfter = length2D(ctx.velocity);
    if (speedAfter > cap) {
      const scale = cap / speedAfter;
      ctx.velocity.x *= scale;
      ctx.velocity.z *= scale;
    }
  }

  if (lengthSq(ctx.velocity) < 1e-6) {
    set(ctx.velocity, 0, 0, 0);
    return;
  }

  stepMove(ctx, dt);
  stayOnGround(ctx);
}
