/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (Valve source-sdk-2013, game/shared/gamemovement.cpp): CGameMovement::Accelerate

import type { Vec3 } from '../../math/vec3.js';

/**
 * Ground acceleration. The `addspeed = wishspeed - dot(vel, wishdir)` term is
 * what caps ground speed at maxspeed: once you're moving at wishspeed in the
 * wish direction no more speed is added.
 */
export function accelerate(vel: Vec3, wishdir: Vec3, wishspeed: number, accel: number, dt: number): void {
  const currentspeed = vel.x * wishdir.x + vel.y * wishdir.y + vel.z * wishdir.z;
  const addspeed = wishspeed - currentspeed;
  if (addspeed <= 0) return;

  let accelspeed = accel * dt * wishspeed;
  if (accelspeed > addspeed) accelspeed = addspeed;

  vel.x += accelspeed * wishdir.x;
  vel.y += accelspeed * wishdir.y;
  vel.z += accelspeed * wishdir.z;
}
