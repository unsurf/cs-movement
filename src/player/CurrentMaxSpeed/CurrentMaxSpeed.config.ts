/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * The walk key only crops max speed while the player is within this many u/s
 * of walk speed (CheckParameters: speed < maxspeed * 0.52 + 25). Faster than
 * that, you keep your run max speed and just decelerate through friction.
 */
export const WALK_CAP_LEEWAY = 25;
