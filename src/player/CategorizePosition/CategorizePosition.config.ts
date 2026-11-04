/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
export const NON_JUMP_VELOCITY = 140; // CategorizePosition: moving up faster than this is never "on ground" (gamemovement.cpp NON_JUMP_VELOCITY)
export const GROUND_TRACE_DIST = 2; // CategorizePosition trace-down distance
