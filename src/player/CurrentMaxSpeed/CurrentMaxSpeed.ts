/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (cstrike15_src@f82112a, cs_gamemovement.cpp): CCSGameMovement::CheckParameters

import type { AccelerateModifiers } from '../../physics/Accelerate/Accelerate.types.js';
import { length } from '../../math/vec3.js';
import { staminaSpeedMultiplier } from '../../physics/Stamina/Stamina.js';
import type { MovementContext } from '../MovementContext.js';
import { SLOW_SNIPER_WALK_SPEED, WEAPON_SPEED_REFERENCE } from '../WeaponState/WeaponState.config.js';
import { WALK_CAP_LEEWAY } from './CurrentMaxSpeed.config.js';

/** IN_DUCK || m_bDucking || FL_DUCKING: any duck-related state, including transitions. */
export function isDuckingState(ctx: MovementContext): boolean {
  return ctx.duckHeld || ctx.ducking || ctx.duckFlag || ctx.ducked;
}

/** The walk key is ignored while ducking. */
export function isWalkKeyActive(ctx: MovementContext): boolean {
  return ctx.input.walk && !isDuckingState(ctx);
}

/** player->m_flMaxspeed: the run speed, lowered to the active weapon's speed when it is slower. */
export function baseMaxSpeed(ctx: MovementContext): number {
  const weapon = ctx.weapon;
  return weapon === null ? ctx.settings.runSpeed : Math.min(ctx.settings.runSpeed, weapon.maxSpeed);
}

/** CS_PLAYER_SPEED_WALK_MODIFIER: walkSpeed / runSpeed. */
export function walkModifier(ctx: MovementContext): number {
  return ctx.settings.walkSpeed / ctx.settings.runSpeed;
}

/** CS_PLAYER_SPEED_DUCK_MODIFIER: crouchSpeed / runSpeed. */
export function duckModifier(ctx: MovementContext): number {
  return ctx.settings.crouchSpeed / ctx.settings.runSpeed;
}

/**
 * HandleDuckingSpeedCrop: max speed (and the move vector) scale by the duck
 * modifier lerped by how far into the duck the player is, so the crop eases
 * in and out with the duck amount rather than switching.
 */
export function duckSpeedModifier(ctx: MovementContext): number {
  if (!isDuckingState(ctx)) return 1;
  return duckModifier(ctx) * ctx.duckFrac + 1 - ctx.duckFrac;
}

export function currentMaxSpeed(ctx: MovementContext): number {
  let speed = baseMaxSpeed(ctx);
  const walkSpeed = speed * walkModifier(ctx);
  if (isWalkKeyActive(ctx) && length(ctx.velocity) < walkSpeed + WALK_CAP_LEEWAY) speed = walkSpeed;
  speed *= duckSpeedModifier(ctx);

  // m_flVelocityModifier only applies to the ground move.
  if (ctx.onGround) speed *= ctx.velocityModifier;

  if (ctx.settings.stamina.enabled) {
    speed *= staminaSpeedMultiplier(ctx.stamina);
  }
  return speed;
}

const modifiers: AccelerateModifiers = {
  ducking: false,
  walking: false,
  duckModifier: 1,
  walkModifier: 1,
  weaponFactor: 1,
  slowSniperScoped: false,
};

/** CCSGameMovement::Accelerate's duck/walk/weapon state, derived from the live context. Reused object. */
export function accelerateModifiers(ctx: MovementContext): AccelerateModifiers {
  const weapon = ctx.weapon;
  const useWeapon = ctx.settings.physics.accelerateUseWeaponSpeed && weapon !== null;
  modifiers.ducking = isDuckingState(ctx);
  modifiers.walking = isWalkKeyActive(ctx);
  modifiers.duckModifier = duckModifier(ctx);
  modifiers.walkModifier = walkModifier(ctx);
  modifiers.weaponFactor = useWeapon ? Math.min(1, weapon.maxSpeed / WEAPON_SPEED_REFERENCE) : 1;
  modifiers.slowSniperScoped =
    useWeapon && weapon.scoped && weapon.maxSpeed * modifiers.walkModifier < SLOW_SNIPER_WALK_SPEED;
  return modifiers;
}
