/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { length2D } from '../../math/vec3.js';
import { GRAVITY } from '../../constants.js';
import { airAccelerate } from '../../physics/AirAccelerate/AirAccelerate.js';
import { AIR_SPEED_CEILING_SOFTNESS } from '../../physics/PerfBonus/PerfBonus.config.js';
import { applyAirSpeedCeiling } from '../../physics/PerfBonus/PerfBonus.js';
import type { MovementContext } from '../MovementContext.js';
import { tryPlayerMove } from '../TryPlayerMove/TryPlayerMove.js';
import { computeWish } from '../WishDir/WishDir.js';

// noPrestrafe never touches this function: air-strafe/prestrafe gain stays
// fully unrestricted, whatever that setting is. "nopre" instead means the
// speed you build that way can't be CASHED IN on the ground — see
// WalkMove.ts. perf.enabled DOES touch this function (see below) — real
// bhop-assist chasemod servers cap air speed itself, not just the takeoff.
export function airMove(ctx: MovementContext, dt: number): void {
  const wishspeed = computeWish(ctx);
  airAccelerate(ctx.velocity, ctx.wishDir, wishspeed, ctx.settings.airAccelerate, dt);

  ctx.velocity.y -= 0.5 * GRAVITY * dt; // half gravity before the move
  tryPlayerMove(ctx, dt);
  ctx.velocity.y -= 0.5 * GRAVITY * dt; // half gravity after

  if (ctx.surfing) {
    // Surfing lets you build as much speed as you want, full stop — and
    // that stays true for the rest of this flight even after you leave the
    // ramp, until you actually touch ground again (see Jump.ts, which
    // clears this the moment a fresh jump launches).
    ctx.surfedSinceGrounded = true;
  }

  // Real bhop-assist servers cap air speed itself around perf.maxAirSpeed,
  // not just what a perfect-bhop carry restores at takeoff (Jump.ts) —
  // otherwise air-strafe gain between hops pushes the observed peak well
  // past the intended ceiling. Surfing (and anything carried from it) is
  // exempt — it's a different physics path and is supposed to exceed this.
  if (ctx.settings.perf.enabled && !ctx.surfing && !ctx.surfedSinceGrounded) {
    const speed = length2D(ctx.velocity);
    const capped = applyAirSpeedCeiling(speed, ctx.settings.perf.maxAirSpeed, AIR_SPEED_CEILING_SOFTNESS);
    if (capped < speed) {
      const scale = capped / speed;
      ctx.velocity.x *= scale;
      ctx.velocity.z *= scale;
    }
  }
}
