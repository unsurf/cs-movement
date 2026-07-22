/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { bhopCarryWeight } from '../../physics/PerfBonus/PerfBonus.js';
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
  // (Source's PreventBunnyJumping), so hops don't compound speed. Real
  // bhop-assist plugins run on top of this, not instead of it — a failed
  // rejump (see below) is left exactly here, at the vanilla clamp.
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
    // Real bhop-assist velocity carry (sm_realbhop's model), not a synthetic
    // multiplier: blend the current (clamped/friction-decayed) velocity back
    // toward what you actually landed with, weighted by how late this
    // rejump is. hasJumpedBefore rules out chaining off a landing that never
    // really happened — gravity settling you onto the ground you spawned on
    // resets groundTicksSinceLanding to 0 exactly like a real landing does.
    const framesTooLate = ctx.groundTicksSinceLanding;
    const weight = ctx.hasJumpedBefore
      ? bhopCarryWeight(framesTooLate, ctx.settings.perf.maxBhopFrames, ctx.settings.perf.framePenalty)
      : 0;
    if (weight > 0) {
      ctx.velocity.x += (ctx.landingVelocity.x - ctx.velocity.x) * weight;
      ctx.velocity.z += (ctx.landingVelocity.z - ctx.velocity.z) * weight;
      ctx.lastHopQuality = framesTooLate <= 0 ? 'perfect' : 'grey';
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
}
