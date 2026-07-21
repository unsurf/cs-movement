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
  accelerate(ctx.velocity, ctx.wishDir, wishspeed, ACCELERATE, dt);
  ctx.velocity.y = 0;

  // "nopre": air-strafe/prestrafe gain (AirMove.ts) is left completely free —
  // this is where it gets spent instead. Ground speed is a hard ceiling at
  // the player's current max speed, full stop, the moment they're grounded
  // and moving under their own power: no "keep whatever you landed with"
  // exception. That's the point of nopre — you can still build wild speed in
  // the air for style/tech, you just can't cash it in as a permanent ground
  // sprint.
  if (ctx.settings.noPrestrafe) {
    const cap = currentMaxSpeed(ctx);
    const speed = length2D(ctx.velocity);
    if (speed > cap) {
      const scale = cap / speed;
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
