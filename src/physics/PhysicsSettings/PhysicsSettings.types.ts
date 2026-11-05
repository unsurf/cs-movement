/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */

/** The server cvars that shape movement feel. Defaults are stock CS:GO. */
export interface PhysicsSettings {
  accelerate: number; // sv_accelerate
  friction: number; // sv_friction
  stopSpeed: number; // sv_stopspeed
  gravity: number; // sv_gravity, u/s^2
  maxVelocity: number; // sv_maxvelocity: per-axis speed bound
  airSpeedCap: number; // sv_air_max_wishspeed: wishspeed clamp in AirAccelerate
  ladderScaleSpeed: number; // sv_ladder_scale_speed
  timeBetweenDucks: number; // sv_timebetweenducks, seconds
  accelerateUseWeaponSpeed: boolean; // sv_accelerate_use_weapon_speed
  velocityRecoveryRate: number; // m_flVelocityModifier regained per second while grounded (1 / 2.5)
}
