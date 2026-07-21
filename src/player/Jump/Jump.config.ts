/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { GRAVITY } from '../../constants.js';

export const JUMP_HEIGHT = 57; // jump apex, units
export const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT); // ≈ 301.993
// sv_enablebunnyhopping 0: horizontal speed is clamped to 1.1 × maxspeed on
// every takeoff, so hops cruise ~275 instead of gaining unboundedly.
export const BHOP_MAX_SPEED_FACTOR = 1.1;
