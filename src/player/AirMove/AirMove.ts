/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { GRAVITY } from '../../constants.js';
import { airAccelerate } from '../../physics/AirAccelerate/AirAccelerate.js';
import type { MovementContext } from '../MovementContext.js';
import { tryPlayerMove } from '../TryPlayerMove/TryPlayerMove.js';
import { computeWish } from '../WishDir/WishDir.js';

// noPrestrafe never touches this function: air-strafe/prestrafe gain stays
// fully unrestricted, whatever the setting. "nopre" instead means the speed
// you build that way can't be CASHED IN on the ground — see WalkMove.ts.
export function airMove(ctx: MovementContext, dt: number): void {
  const wishspeed = computeWish(ctx);
  airAccelerate(ctx.velocity, ctx.wishDir, wishspeed, ctx.settings.airAccelerate, dt);

  ctx.velocity.y -= 0.5 * GRAVITY * dt; // half gravity before the move
  tryPlayerMove(ctx, dt);
  ctx.velocity.y -= 0.5 * GRAVITY * dt; // half gravity after
}
