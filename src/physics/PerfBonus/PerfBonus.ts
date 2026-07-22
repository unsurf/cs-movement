/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Squeezes a speed above `ceiling` asymptotically toward it, so a chain
 * gains a little less the further past the ceiling it already is —
 * diminishing returns instead of a hard clamp. Speeds at or below `ceiling`
 * pass through untouched; `softness` controls how gradually the curve
 * approaches the ceiling (the true asymptote sits `softness` units above
 * it, which is deliberate — an exact hard ceiling would just be
 * `bhopSpeedClamp` again).
 */
export function applyAirSpeedCeiling(speed: number, ceiling: number, softness: number): number {
  if (speed <= ceiling) return speed;
  const excess = speed - ceiling;
  return ceiling + softness * (1 - Math.exp(-excess / softness));
}
