/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (cstrike15_src@f82112a, game/shared/gamemovement.cpp): CGameMovement::CheckVelocity

import type { Vec3 } from '../../math/vec3.js';
import { MAX_VELOCITY } from './CheckVelocity.config.js';

function bound(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v > MAX_VELOCITY) return MAX_VELOCITY;
  if (v < -MAX_VELOCITY) return -MAX_VELOCITY;
  return v;
}

/** sv_maxvelocity: clamps each velocity axis to ±3500 and scrubs NaNs. */
export function checkVelocity(vel: Vec3): void {
  vel.x = bound(vel.x);
  vel.y = bound(vel.y);
  vel.z = bound(vel.z);
}
