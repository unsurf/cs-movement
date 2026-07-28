/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { staminaPenaltyMultiplier } from '../../physics/Stamina/Stamina.js';
import type { MovementContext } from '../MovementContext.js';

export function currentMaxSpeed(ctx: MovementContext): number {
  let speed: number;
  if (ctx.ducked) speed = ctx.settings.crouchSpeed;
  else if (ctx.input.walk) speed = ctx.settings.walkSpeed;
  else speed = ctx.settings.runSpeed;

  if (ctx.settings.stamina.enabled) {
    speed *= staminaPenaltyMultiplier(ctx.stamina, ctx.settings.stamina.max, ctx.settings.stamina.maxPenalty);
  }
  return speed;
}
