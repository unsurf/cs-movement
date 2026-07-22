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
  // (Source's PreventBunnyJumping), so hops don't compound speed. This is
  // the only speed limit a bhop takeoff gets — no carry-forward assist on
  // top of it, so a landing never "retains" speed from a well-timed or
  // lucky rejump; every takeoff is judged fresh against this clamp.
  if (ctx.settings.bhopSpeedClamp) {
    const maxScaled = currentMaxSpeed(ctx) * BHOP_MAX_SPEED_FACTOR;
    const speed = ctx.horizontalSpeed;
    if (speed > maxScaled) {
      const fraction = maxScaled / speed;
      ctx.velocity.x *= fraction;
      ctx.velocity.z *= fraction;
    }
  }

  let jumpVelocity = JUMP_VELOCITY;
  if (ctx.settings.stamina.enabled) {
    jumpVelocity *= staminaPenaltyMultiplier(ctx.stamina, ctx.settings.stamina.max, ctx.settings.stamina.maxPenalty);
    ctx.stamina = addStamina(ctx.stamina, ctx.settings.stamina.jumpCost, ctx.settings.stamina.max);
  }
  ctx.velocity.y = jumpVelocity;
  ctx.onGround = false;
}
