/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (Valve source-sdk-2013, game/shared/gamemovement.cpp): CGameMovement::ClipVelocity

import type { Vec3 } from '../../math/vec3.js';

/**
 * Slide velocity along a plane. overbounce 1.0 (surf) removes exactly the
 * into-plane component; 1.001 (ordinary clipping) removes a hair more so the
 * player doesn't re-penetrate the plane next tick.
 */
export function clipVelocity(vel: Vec3, normal: Vec3, overbounce: number): void {
  const backoff = (vel.x * normal.x + vel.y * normal.y + vel.z * normal.z) * overbounce;
  vel.x -= normal.x * backoff;
  vel.y -= normal.y * backoff;
  vel.z -= normal.z * backoff;

  // CS:GO's extra adjust step (added to Source for surf ramps): float error
  // can leave a residual into-plane component at overbounce 1.0, which makes
  // the mover re-collide with the same plane every tick and eventually stick.
  const adjust = vel.x * normal.x + vel.y * normal.y + vel.z * normal.z;
  if (adjust < 0) {
    vel.x -= normal.x * adjust;
    vel.y -= normal.y * adjust;
    vel.z -= normal.z * adjust;
  }
}
