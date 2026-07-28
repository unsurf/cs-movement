/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { staminaPenaltyMultiplier } from '../../physics/Stamina/Stamina.js';
import type { MovementContext } from '../MovementContext.js';

/**
 * `ignoreDuck` exists for the anti-bhop takeoff clamp (Jump.ts): duck is
 * processed before checkJump each tick, so a duck pressed on the very same
 * tick as jump would otherwise read ctx.ducked as already true and clamp the
 * takeoff to crouch speed — punishing the ordinary duck-jump/longjump
 * technique, which CS:GO does not do. Ground movement (WalkMove, WishDir)
 * should still cap at crouch speed while ducked — that's a real, separate
 * mechanic — so this only ever gets passed at the one call site that needs it.
 */
export function currentMaxSpeed(ctx: MovementContext, opts: { ignoreDuck?: boolean } = {}): number {
  let speed: number;
  if (ctx.ducked && !opts.ignoreDuck) speed = ctx.settings.crouchSpeed;
  else if (ctx.input.walk) speed = ctx.settings.walkSpeed;
  else speed = ctx.settings.runSpeed;

  if (ctx.settings.stamina.enabled) {
    speed *= staminaPenaltyMultiplier(ctx.stamina, ctx.settings.stamina.max, ctx.settings.stamina.maxPenalty);
  }
  return speed;
}
