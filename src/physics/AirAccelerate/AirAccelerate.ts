/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (Valve source-sdk-2013, game/shared/gamemovement.cpp): CGameMovement::AirAccelerate

import type { Vec3 } from '../../math/vec3.js';
import { AIR_SPEED_CAP } from './AirAccelerate.config.js';

/**
 * Air acceleration — the bhop/surf formula. Note the deliberate asymmetry:
 * `addspeed` uses the 30 u/s capped wishspeed, but `accelspeed` uses the
 * UNCAPPED wishspeed. That is exactly what Source does, and it's why large
 * sv_airaccelerate values give near-instant air control. There is no cap on
 * the resulting velocity, which is what lets strafing exceed maxspeed.
 */
export function airAccelerate(
  vel: Vec3,
  wishdir: Vec3,
  wishspeed: number,
  airaccel: number,
  dt: number,
  airCap: number = AIR_SPEED_CAP,
): void {
  const wishspd = wishspeed > airCap ? airCap : wishspeed;

  const currentspeed = vel.x * wishdir.x + vel.y * wishdir.y + vel.z * wishdir.z;
  const addspeed = wishspd - currentspeed;
  if (addspeed <= 0) return;

  let accelspeed = airaccel * wishspeed * dt;
  if (accelspeed > addspeed) accelspeed = addspeed;

  vel.x += accelspeed * wishdir.x;
  vel.y += accelspeed * wishdir.y;
  vel.z += accelspeed * wishdir.z;
}
