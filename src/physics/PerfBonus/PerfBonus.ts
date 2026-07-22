/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * How much of `landingVelocity` a takeoff carries, per sm_realbhop's model:
 * full carry (1) at 0 frames late, decaying by `framePenalty` per frame late,
 * hard-cutting to 0 (no carry at all, just whatever bhopSpeedClamp already
 * left the takeoff at) past `maxBhopFrames`. This is a discontinuity at the
 * window edge, not a taper — that's how the real plugin behaves.
 */
export function bhopCarryWeight(framesTooLate: number, maxBhopFrames: number, framePenalty: number): number {
  if (framesTooLate < 0 || framesTooLate > maxBhopFrames) return 0;
  return framePenalty ** framesTooLate;
}
