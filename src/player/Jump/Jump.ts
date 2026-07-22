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
    // toward what you actually landed with. hasJumpedBefore rules out
    // chaining off a landing that never really happened — gravity settling
    // you onto the ground you spawned on resets groundTicksSinceLanding to 0
    // exactly like a real landing does.
    const framesTooLate = ctx.groundTicksSinceLanding;
    let weight = 0;
    if (ctx.hasJumpedBefore) {
      if (ctx.settings.autobhop) {
        // Held-jump autobhop always re-fires at 0 ticks late, so the
        // frame-timing math below would treat every hop as a guaranteed
        // full carry — permanently defeating bhopSpeedClamp, since the
        // carry would restore whatever you landed with every single time
        // and the clamp would never get a tick to actually hold speed down.
        // Real servers roll a per-hop chance instead.
        weight = ctx.rng() < ctx.settings.perf.autobhopChance ? 1 : 0;
      } else {
        weight = bhopCarryWeight(framesTooLate, ctx.settings.perf.maxBhopFrames, ctx.settings.perf.framePenalty);
      }
    }
    if (weight > 0) {
      ctx.velocity.x += (ctx.landingVelocity.x - ctx.velocity.x) * weight;
      ctx.velocity.z += (ctx.landingVelocity.z - ctx.velocity.z) * weight;

      // No local squeeze here — AirMove.ts applies the maxAirSpeed ceiling
      // continuously while airborne (including this very tick, since it
      // runs right after this function whenever onGround just went false),
      // which is what actually keeps a chain from exceeding it, not just
      // the takeoff instant.

      // Under autobhop, timing is irrelevant to whether the carry succeeds
      // (that's the whole reason it's a chance roll instead), so a hit is
      // always 'perfect' regardless of how many ticks have actually passed
      // since the last landing.
      ctx.lastHopQuality = ctx.settings.autobhop || framesTooLate <= 0 ? 'perfect' : 'grey';
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
