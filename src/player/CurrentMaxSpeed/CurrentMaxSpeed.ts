/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (cstrike15_src@f82112a, cs_gamemovement.cpp): CCSGameMovement::CheckParameters

import type { AccelerateModifiers } from '../../physics/Accelerate/Accelerate.types.js';
import { length } from '../../math/vec3.js';
import { staminaPenaltyMultiplier } from '../../physics/Stamina/Stamina.js';
import type { MovementContext } from '../MovementContext.js';
import { WALK_CAP_LEEWAY } from './CurrentMaxSpeed.config.js';

/** The walk key is ignored while ducking. */
export function isWalkKeyActive(ctx: MovementContext): boolean {
  return ctx.input.walk && !ctx.ducked;
}

export function currentMaxSpeed(ctx: MovementContext): number {
  let speed: number;
  if (ctx.ducked) speed = ctx.settings.crouchSpeed;
  else if (isWalkKeyActive(ctx) && length(ctx.velocity) < ctx.settings.walkSpeed + WALK_CAP_LEEWAY) {
    speed = ctx.settings.walkSpeed;
  } else speed = ctx.settings.runSpeed;

  if (ctx.settings.stamina.enabled) {
    speed *= staminaPenaltyMultiplier(ctx.stamina, ctx.settings.stamina.max, ctx.settings.stamina.maxPenalty);
  }
  return speed;
}

const modifiers: AccelerateModifiers = { speedFactor: 1, walking: false };

/** CCSGameMovement::Accelerate's duck/walk state, derived from the live context. Reused object. */
export function accelerateModifiers(ctx: MovementContext): AccelerateModifiers {
  const { runSpeed, crouchSpeed, walkSpeed } = ctx.settings;
  const walking = isWalkKeyActive(ctx);
  modifiers.walking = walking;
  modifiers.speedFactor = ctx.ducked ? crouchSpeed / runSpeed : walking ? walkSpeed / runSpeed : 1;
  return modifiers;
}
