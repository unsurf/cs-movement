/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * The slice of the active weapon that movement reads (CWeaponCSBase). The host
 * owns weapons; it just keeps this up to date (including on scope in/out).
 */
export interface WeaponState {
  /** CWeaponCSBase::GetMaxSpeed(): u/s while holding it, already reflecting zoom. */
  maxSpeed: number;
  /** GetCSZoomLevel() > 0 on a weapon with more than one zoom level (a scoped sniper). */
  scoped: boolean;
}
