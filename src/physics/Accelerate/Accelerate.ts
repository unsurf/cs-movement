/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (cstrike15_src@f82112a, game/shared/cstrike15/cs_gamemovement.cpp): CCSGameMovement::Accelerate

import type { Vec3 } from '../../math/vec3.js';
import { ACCEL_REFERENCE_SPEED, WALK_ACCEL_FADE_RANGE } from './Accelerate.config.js';
import type { AccelerateModifiers } from './Accelerate.types.js';

const NO_MODIFIERS: AccelerateModifiers = {
  ducking: false,
  walking: false,
  duckModifier: 1,
  walkModifier: 1,
  weaponFactor: 1,
  slowSniperScoped: false,
};

/**
 * Ground acceleration. The `addspeed = wishspeed - dot(vel, wishdir)` term is
 * what caps ground speed at maxspeed: once you're moving at wishspeed in the
 * wish direction no more speed is added.
 *
 * CS scales the step by max(250, wishspeed) rather than by wishspeed alone, so
 * slow movement states keep their own acceleration instead of inheriting a
 * tiny wishspeed. That scale is then multiplied by the weapon speed factor
 * (when not ducking/walking, or when slow-sniper-scoped) and by the duck/walk
 * modifier (unless slow-sniper-scoped). The "goal speed" mirrors it but always
 * takes every factor; while walking, acceleration fades to nothing over the
 * last WALK_ACCEL_FADE_RANGE u/s below that goal so walk speed doesn't
 * overshoot.
 */
export function accelerate(
  vel: Vec3,
  wishdir: Vec3,
  wishspeed: number,
  accel: number,
  dt: number,
  mods: AccelerateModifiers = NO_MODIFIERS,
): void {
  const rawSpeed = vel.x * wishdir.x + vel.y * wishdir.y + vel.z * wishdir.z;
  const addspeed = wishspeed - rawSpeed;
  if (addspeed <= 0) return;
  const currentspeed = Math.max(0, rawSpeed);

  let accelScale = Math.max(ACCEL_REFERENCE_SPEED, wishspeed);
  let goalSpeed = accelScale;
  const { ducking, walking, slowSniperScoped } = mods;

  goalSpeed *= mods.weaponFactor;
  if ((!ducking && !walking) || ((walking || ducking) && slowSniperScoped)) {
    accelScale *= mods.weaponFactor;
  }
  if (ducking) {
    if (!slowSniperScoped) accelScale *= mods.duckModifier;
    goalSpeed *= mods.duckModifier;
  }
  if (walking) {
    if (!slowSniperScoped) accelScale *= mods.walkModifier;
    goalSpeed *= mods.walkModifier;
  }

  let effectiveAccel = accel;
  if (walking && currentspeed > goalSpeed - WALK_ACCEL_FADE_RANGE) {
    const over = Math.max(0, currentspeed - (goalSpeed - WALK_ACCEL_FADE_RANGE));
    effectiveAccel *= Math.min(1, Math.max(0, 1 - over / WALK_ACCEL_FADE_RANGE));
  }

  let accelspeed = effectiveAccel * dt * accelScale;
  if (accelspeed > addspeed) accelspeed = addspeed;

  vel.x += accelspeed * wishdir.x;
  vel.y += accelspeed * wishdir.y;
  vel.z += accelspeed * wishdir.z;
}
