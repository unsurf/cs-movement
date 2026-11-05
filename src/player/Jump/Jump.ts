/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { length, scale } from '../../math/vec3.js';
import { finishGravity } from '../Gravity/Gravity.js';
import { addStamina, staminaJumpMultiplier } from '../../physics/Stamina/Stamina.js';
import { baseMaxSpeed } from '../CurrentMaxSpeed/CurrentMaxSpeed.js';
import type { MovementContext } from '../MovementContext.js';
import { BHOP_MAX_SPEED_FACTOR, JUMP_VELOCITY } from './Jump.config.js';

export function checkJump(ctx: MovementContext, dt: number): void {
  if (!ctx.onGround) return;
  if (!ctx.input.jump) return;
  // Vanilla behavior: the press must happen on the ground — holding jump
  // from mid-air does nothing on landing. Autobhop skips that check.
  if (!ctx.settings.autobhop && ctx.oldJump) return;

  // sv_enablebunnyhopping 0: clamp takeoff speed to 1.1 × maxspeed
  // (CCSGameMovement::PreventBunnyJumping), so hops don't compound speed.
  // The reference is the player's BASE max speed (player->m_flMaxspeed, i.e.
  // the weapon speed) — not the duck/walk-cropped mv->m_flMaxSpeed — so
  // crouch-jumping or walk-jumping still clamps at 1.1 × run speed. The
  // whole 3D velocity is scaled, exactly like the C++. A perfect-bhop carry
  // (below) can restore more than this, but everything else — a late
  // rejump, autobhop, or a surf-derived landing — is left exactly here.
  if (ctx.settings.bhopSpeedClamp) {
    const maxScaled = baseMaxSpeed(ctx) * BHOP_MAX_SPEED_FACTOR;
    const speed = length(ctx.velocity);
    if (speed > maxScaled) {
      scale(ctx.velocity, ctx.velocity, maxScaled / speed);
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

  const startY = ctx.velocity.y;
  // CCSGameMovement::CheckJumpButton: a ducking jump SETS vertical velocity;
  // a standing one ADDS to it, so it keeps the half-tick of gravity that
  // StartGravity already took off. Then the second half is applied right
  // here (FinishGravity), before the move — a standing jump therefore moves
  // with jump - g*dt on its first tick, not jump - g*dt/2.
  if (ctx.ducking || ctx.duckFlag || ctx.ducked) ctx.velocity.y = JUMP_VELOCITY;
  else ctx.velocity.y += JUMP_VELOCITY;
  // Fatigue scales the whole vertical velocity, using the stamina the player
  // arrived with (this jump's own cost is added afterwards).
  if (ctx.settings.stamina.enabled) ctx.velocity.y *= staminaJumpMultiplier(ctx.stamina);
  finishGravity(ctx, dt);
  // OnJump: the cost is proportional to the vertical velocity the jump added.
  if (ctx.settings.stamina.enabled) {
    const { jumpCost, max } = ctx.settings.stamina;
    ctx.stamina = addStamina(ctx.stamina, jumpCost * (ctx.velocity.y - startY), max);
  }
  ctx.onGround = false;
  ctx.hasJumpedBefore = true;
  // Starting a brand-new flight either way — any surf touch from before
  // this takeoff is no longer relevant to whatever happens next.
  ctx.surfedSinceGrounded = false;
}
