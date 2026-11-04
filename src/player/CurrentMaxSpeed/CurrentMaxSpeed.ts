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

/** IN_DUCK || m_bDucking || FL_DUCKING: any duck-related state, including transitions. */
export function isDuckingState(ctx: MovementContext): boolean {
  return ctx.duckHeld || ctx.ducking || ctx.duckFlag || ctx.ducked;
}

/** The walk key is ignored while ducking. */
export function isWalkKeyActive(ctx: MovementContext): boolean {
  return ctx.input.walk && !isDuckingState(ctx);
}

/**
 * HandleDuckingSpeedCrop: max speed (and the move vector) scale by
 * crouchSpeed/runSpeed lerped by how far into the duck the player is, so
 * the crop eases in and out with the duck amount rather than switching.
 */
export function duckSpeedModifier(ctx: MovementContext): number {
  if (!isDuckingState(ctx)) return 1;
  const full = ctx.settings.crouchSpeed / ctx.settings.runSpeed;
  return full * ctx.duckFrac + 1 - ctx.duckFrac;
}

export function currentMaxSpeed(ctx: MovementContext): number {
  let speed: number;
  if (isWalkKeyActive(ctx) && length(ctx.velocity) < ctx.settings.walkSpeed + WALK_CAP_LEEWAY) {
    speed = ctx.settings.walkSpeed;
  } else speed = ctx.settings.runSpeed;
  speed *= duckSpeedModifier(ctx);

  if (ctx.settings.stamina.enabled) {
    speed *= staminaPenaltyMultiplier(ctx.stamina, ctx.settings.stamina.max, ctx.settings.stamina.maxPenalty);
  }
  return speed;
}

const modifiers: AccelerateModifiers = { speedFactor: 1, walking: false };

/** CCSGameMovement::Accelerate's duck/walk state, derived from the live context. Reused object. */
export function accelerateModifiers(ctx: MovementContext): AccelerateModifiers {
  const { runSpeed, crouchSpeed, walkSpeed } = ctx.settings;
  const ducking = isDuckingState(ctx);
  const walking = isWalkKeyActive(ctx);
  modifiers.walking = walking;
  // Unlike the max-speed crop, Accelerate applies the full duck factor as soon
  // as any duck state is active — it is not eased by the duck amount.
  modifiers.speedFactor = ducking ? crouchSpeed / runSpeed : walking ? walkSpeed / runSpeed : 1;
  return modifiers;
}
