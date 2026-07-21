/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Manual-timing bhop bonus. `ticksSinceLanding` is how many ground-friction
 * ticks already ran before this takeoff (0 = the earliest possible rejump,
 * the tick right after landing). Falls off linearly to 0 at the window edge.
 */
export function perfBonusFactor(ticksSinceLanding: number, greyWindowTicks: number, bonusFactor: number): number {
  if (ticksSinceLanding <= 0) return bonusFactor;
  if (greyWindowTicks <= 0 || ticksSinceLanding >= greyWindowTicks) return 0;
  return bonusFactor * (1 - ticksSinceLanding / greyWindowTicks);
}
