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

const NO_MODIFIERS: AccelerateModifiers = { speedFactor: 1, walking: false };

/**
 * Ground acceleration. The `addspeed = wishspeed - dot(vel, wishdir)` term is
 * what caps ground speed at maxspeed: once you're moving at wishspeed in the
 * wish direction no more speed is added.
 *
 * CS scales the step by max(250, wishspeed) rather than by wishspeed alone,
 * times the duck/walk multiplier (`mods.speedFactor`), so slow movement states
 * keep their own acceleration instead of inheriting a tiny wishspeed. While
 * walking, acceleration also fades to nothing over the last
 * WALK_ACCEL_FADE_RANGE u/s below the walk goal so walk speed doesn't
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
  const currentspeed = vel.x * wishdir.x + vel.y * wishdir.y + vel.z * wishdir.z;
  const addspeed = wishspeed - currentspeed;
  if (addspeed <= 0) return;

  const accelScale = Math.max(ACCEL_REFERENCE_SPEED, wishspeed) * mods.speedFactor;

  let effectiveAccel = accel;
  if (mods.walking) {
    const fadeStart = accelScale - WALK_ACCEL_FADE_RANGE;
    const speed = Math.max(0, currentspeed);
    if (speed > fadeStart) {
      effectiveAccel *= Math.min(1, Math.max(0, 1 - (speed - fadeStart) / WALK_ACCEL_FADE_RANGE));
    }
  }

  let accelspeed = effectiveAccel * dt * accelScale;
  if (accelspeed > addspeed) accelspeed = addspeed;

  vel.x += accelspeed * wishdir.x;
  vel.y += accelspeed * wishdir.y;
  vel.z += accelspeed * wishdir.z;
}
