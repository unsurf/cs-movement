/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { lengthSq, set } from '../../math/vec3.js';
import { accelerate } from '../../physics/Accelerate/Accelerate.js';
import { ACCELERATE } from '../../physics/Accelerate/Accelerate.config.js';
import { applyFriction } from '../../physics/Friction/Friction.js';
import { FRICTION, STOP_SPEED } from '../../physics/Friction/Friction.config.js';
import type { MovementContext } from '../MovementContext.js';
import { stayOnGround } from '../StayOnGround/StayOnGround.js';
import { stepMove } from '../StepMove/StepMove.js';
import { computeWish } from '../WishDir/WishDir.js';

export function walkMove(ctx: MovementContext, dt: number): void {
  ctx.velocity.y = 0;
  applyFriction(ctx.velocity, FRICTION, STOP_SPEED, dt);

  const wishspeed = computeWish(ctx);
  accelerate(ctx.velocity, ctx.wishDir, wishspeed, ACCELERATE, dt);
  ctx.velocity.y = 0;

  if (lengthSq(ctx.velocity) < 1e-6) {
    set(ctx.velocity, 0, 0, 0);
    return;
  }

  stepMove(ctx, dt);
  stayOnGround(ctx);
}
