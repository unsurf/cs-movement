/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
export const ACCELERATE = 5.5; // sv_accelerate (movevars_shared.cpp, cstrike15_src@f82112a)
/** Ground acceleration is scaled by max(this, wishspeed): the stock 250 u/s run speed. */
export const ACCEL_REFERENCE_SPEED = 250;
/** While walking, acceleration fades to zero over the last this-many u/s below the walk goal speed. */
export const WALK_ACCEL_FADE_RANGE = 5;
