/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { addStamina, staminaPenaltyMultiplier } from '../../physics/Stamina/Stamina.js';
import { currentMaxSpeed } from '../CurrentMaxSpeed/CurrentMaxSpeed.js';
import type { MovementContext } from '../MovementContext.js';
import { BHOP_MAX_SPEED_FACTOR, JUMP_VELOCITY } from './Jump.config.js';

export function checkJump(ctx: MovementContext): void {
  if (!ctx.onGround) return;
  if (!ctx.input.jump) return;
  // Vanilla behavior: the press must happen on the ground — holding jump
  // from mid-air does nothing on landing. Autobhop skips that check.
  if (!ctx.settings.autobhop && ctx.oldJump) return;

  // sv_enablebunnyhopping 0: clamp takeoff speed to 1.1 × maxspeed
  // (Source's PreventBunnyJumping), so hops don't compound speed. A
  // perfect-bhop carry (below) can restore more than this, but everything
  // else — a late rejump, autobhop, or a surf-derived landing — is left
  // exactly here.
  if (ctx.settings.bhopSpeedClamp) {
    const maxScaled = currentMaxSpeed(ctx) * BHOP_MAX_SPEED_FACTOR;
    const speed = ctx.horizontalSpeed;
    if (speed > maxScaled) {
      const fraction = maxScaled / speed;
      ctx.velocity.x *= fraction;
      ctx.velocity.z *= fraction;
    }
  }

  if (ctx.settings.perf.enabled) {
    // A "perfect bhop" is a REAL, skill-timed instant rejump: manual input
    // only (autobhop can't have timing skill — it always re-fires the
    // instant it's able to, so it never qualifies, full stop), the tick
    // right after landing, and not off a landing that came from surfing
    // (surf speed isn't something you "cash in" this way). Anything else
    // gets nothing — no partial credit for a near-miss.
    const isPerfectBhop =
      !ctx.settings.autobhop &&
      ctx.hasJumpedBefore &&
      !ctx.surfedSinceGrounded &&
      ctx.groundTicksSinceLanding === 0;
    if (isPerfectBhop) {
      ctx.velocity.x = ctx.landingVelocity.x;
      ctx.velocity.z = ctx.landingVelocity.z;
      ctx.lastHopQuality = 'perfect';
    } else {
      ctx.lastHopQuality = 'normal';
    }
  }

  let jumpVelocity = JUMP_VELOCITY;
  if (ctx.settings.stamina.enabled) {
    jumpVelocity *= staminaPenaltyMultiplier(ctx.stamina, ctx.settings.stamina.max, ctx.settings.stamina.maxPenalty);
    ctx.stamina = addStamina(ctx.stamina, ctx.settings.stamina.jumpCost, ctx.settings.stamina.max);
  }
  ctx.velocity.y = jumpVelocity;
  ctx.onGround = false;
  ctx.hasJumpedBefore = true;
  // Starting a brand-new flight either way — any surf touch from before
  // this takeoff is no longer relevant to whatever happens next.
  ctx.surfedSinceGrounded = false;
}
