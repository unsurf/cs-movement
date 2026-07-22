/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { perfBonusFactor } from '../../physics/PerfBonus/PerfBonus.js';
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
  // (Source's PreventBunnyJumping), so hops don't compound speed.
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
    let bonus: number;
    // Perf/hop-quality rewards a REJUMP — a takeoff within the grey window
    // of an actual previous landing. It can never apply when either:
    //  - there's no previous jump to chain from at all (hasJumpedBefore),
    //    which without this check is indistinguishable from an instant
    //    rejump: gravity settling you onto the ground you spawned on resets
    //    groundTicksSinceLanding to 0 exactly like a real landing does; or
    //  - the last landing (real or spawn-settle) happened longer ago than
    //    the grey window — an isolated jump taken after standing/walking
    //    around isn't bhopping, no matter how long autobhop has been on.
    const withinChainWindow = ctx.hasJumpedBefore && ctx.groundTicksSinceLanding <= ctx.settings.perf.greyWindowTicks;
    if (!withinChainWindow) {
      ctx.lastHopQuality = 'normal';
      bonus = 0;
    } else if (ctx.settings.autobhop) {
      // Autobhop always re-fires on the earliest possible tick, so the
      // tick-based classification below would always read 'perfect' — a
      // guaranteed buff, not a bonus. Roll a chance instead.
      const isPerfect = ctx.rng() < ctx.settings.perf.autobhopChance;
      ctx.lastHopQuality = isPerfect ? 'perfect' : 'normal';
      bonus = isPerfect ? ctx.settings.perf.bonusFactor : 0;
    } else {
      bonus = perfBonusFactor(ctx.groundTicksSinceLanding, ctx.settings.perf.greyWindowTicks, ctx.settings.perf.bonusFactor);
      ctx.lastHopQuality = ctx.groundTicksSinceLanding <= 0 ? 'perfect' : bonus > 0 ? 'grey' : 'normal';
    }
    if (bonus > 0) {
      ctx.velocity.x *= 1 + bonus;
      ctx.velocity.z *= 1 + bonus;
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
