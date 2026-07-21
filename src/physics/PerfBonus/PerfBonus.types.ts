/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Manual-timing bhop bonus: a takeoff within `greyWindowTicks` of the
 * earliest possible rejump (the tick right after landing) gets an extra
 * takeoff-speed multiplier that falls off linearly from `bonusFactor` at 0
 * ticks late to 0 at the window edge. This rewards manual timing on top of
 * the vanilla effect (skipping a tick of ground friction), it doesn't
 * replace it.
 *
 * autobhop trivializes that timing — held jump always re-fires on the
 * earliest possible tick, so the tick-based system above would classify
 * every single hop as a guaranteed 'perfect'. `autobhopChance` swaps in a
 * per-jump coin flip instead while autobhop is on, so the bonus stays a
 * bonus rather than a permanent buff.
 */
export interface PerfSettings {
  enabled: boolean;
  greyWindowTicks: number;
  bonusFactor: number;
  autobhopChance: number; // 0..1, chance of 'perfect' per autobhop jump
}
