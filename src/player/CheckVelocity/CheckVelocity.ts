/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (cstrike15_src@f82112a, game/shared/gamemovement.cpp): CGameMovement::CheckVelocity

import type { Vec3 } from '../../math/vec3.js';
import { MAX_VELOCITY } from './CheckVelocity.config.js';

function bound(v: number, max: number): number {
  if (Number.isNaN(v)) return 0;
  if (v > max) return max;
  if (v < -max) return -max;
  return v;
}

/** sv_maxvelocity: clamps each velocity axis to ±max (default 3500) and scrubs NaNs. */
export function checkVelocity(vel: Vec3, max: number = MAX_VELOCITY): void {
  vel.x = bound(vel.x, max);
  vel.y = bound(vel.y, max);
  vel.z = bound(vel.z, max);
}
