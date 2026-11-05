/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * CCSGameMovement::Accelerate's movement-state inputs.
 */
export interface AccelerateModifiers {
  /** Any duck state is active (IN_DUCK / ducking / FL_DUCKING). */
  ducking: boolean;
  /** Walk key held and not ducking: acceleration fades out just below the walk goal speed. */
  walking: boolean;
  /** crouchSpeed / runSpeed (CS_PLAYER_SPEED_DUCK_MODIFIER). */
  duckModifier: number;
  /** walkSpeed / runSpeed (CS_PLAYER_SPEED_WALK_MODIFIER). */
  walkModifier: number;
  /** min(1, weaponMaxSpeed / 250); 1 when sv_accelerate_use_weapon_speed is off or no weapon. */
  weaponFactor: number;
  /** Zoomed multi-level scope on a weapon slow enough that walk/duck no longer slow acceleration. */
  slowSniperScoped: boolean;
}
