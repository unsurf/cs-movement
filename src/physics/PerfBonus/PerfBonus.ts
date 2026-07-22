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

/**
 * Squeezes a speed above `ceiling` asymptotically toward it, so chaining
 * more perfect hops keeps gaining a little rather than compounding without
 * limit — diminishing returns instead of a hard clamp. Speeds at or below
 * `ceiling` pass through untouched; `softness` controls how gradually the
 * curve approaches the ceiling (the true asymptote sits `softness` units
 * above it, which is deliberate — an exact hard ceiling would just be
 * `bhopSpeedClamp` again).
 */
export function applyAirSpeedCeiling(speed: number, ceiling: number, softness: number): number {
  if (speed <= ceiling) return speed;
  const excess = speed - ceiling;
  return ceiling + softness * (1 - Math.exp(-excess / softness));
}
