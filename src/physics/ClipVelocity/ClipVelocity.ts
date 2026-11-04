/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (cstrike15_src@f82112a, game/shared/gamemovement.cpp): CGameMovement::ClipVelocity

import type { Vec3 } from '../../math/vec3.js';
import { DIST_EPSILON } from '../Collision/Collision.config.js';

/**
 * Slide velocity along a plane. overbounce 1.0 removes exactly the
 * into-plane component (all TryPlayerMove calls use it). Afterwards, if float
 * error left any residual into-plane component, push out by at least
 * DIST_EPSILON so the next sweep can't start re-penetrating the plane.
 */
export function clipVelocity(vel: Vec3, normal: Vec3, overbounce: number): void {
  const backoff = (vel.x * normal.x + vel.y * normal.y + vel.z * normal.z) * overbounce;
  vel.x -= normal.x * backoff;
  vel.y -= normal.y * backoff;
  vel.z -= normal.z * backoff;

  // Iterate once to make sure we aren't still moving through the plane. The
  // correction is never smaller than DIST_EPSILON (a near-parallel crossing
  // would otherwise leave the player grazing the plane forever).
  let adjust = vel.x * normal.x + vel.y * normal.y + vel.z * normal.z;
  if (adjust < 0) {
    adjust = Math.min(adjust, -DIST_EPSILON);
    vel.x -= normal.x * adjust;
    vel.y -= normal.y * adjust;
    vel.z -= normal.z * adjust;
  }
}
