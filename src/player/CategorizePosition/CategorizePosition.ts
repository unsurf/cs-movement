/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { STANDABLE_NORMAL } from '../../constants.js';
import { copy, set } from '../../math/vec3.js';
import { addStamina } from '../../physics/Stamina/Stamina.js';
import type { MovementContext } from '../MovementContext.js';
import { GROUND_TRACE_DIST, NON_JUMP_VELOCITY } from './CategorizePosition.config.js';

function setNotGrounded(ctx: MovementContext): void {
  ctx.onGround = false;
}

export function categorizePosition(ctx: MovementContext): void {
  // Moving up faster than this and we can't be "on" anything.
  if (ctx.velocity.y > NON_JUMP_VELOCITY) {
    setNotGrounded(ctx);
    return;
  }

  const tr = ctx.world.trace(
    ctx.origin,
    set(ctx.tmpA, ctx.origin.x, ctx.origin.y - GROUND_TRACE_DIST, ctx.origin.z),
    ctx.mins,
    ctx.maxs,
  );

  if (tr.fraction < 1 && !tr.startSolid && tr.normal !== null && tr.normal.y >= STANDABLE_NORMAL) {
    const wasAirborne = !ctx.onGround;
    ctx.onGround = true;
    copy(ctx.groundNormal, tr.normal);
    copy(ctx.origin, tr.endPos);
    if (wasAirborne) {
      ctx.groundTicksSinceLanding = 0;
      // Only y gets clipped by the floor plane's normal this tick — x/z still
      // hold the actual speed the player landed with. Snapshot it now, before
      // walkMove's friction gets a chance to bleed it, so a perfect rejump
      // has something real to carry back to (see PerfBonus).
      set(ctx.landingVelocity, ctx.velocity.x, ctx.velocity.y, ctx.velocity.z);
      if (ctx.settings.stamina.enabled) {
        ctx.stamina = addStamina(ctx.stamina, ctx.settings.stamina.landCost, ctx.settings.stamina.max);
      }
      if (ctx.settings.viewPunch && ctx.fallVelocity > 250) {
        ctx.landPunch = Math.min((ctx.fallVelocity - 250) * 0.012, 10);
      }
    }
    ctx.fallVelocity = 0;
  } else {
    setNotGrounded(ctx);
  }
}
