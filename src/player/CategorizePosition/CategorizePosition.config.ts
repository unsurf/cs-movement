/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
export const NON_JUMP_VELOCITY = 140; // CategorizePosition: moving up faster than this is never "on ground" (gamemovement.cpp NON_JUMP_VELOCITY)
export const RISING_SURFACE_FRICTION = 0.25; // m_surfaceFriction while moving up with no valid ground below
export const GROUND_TRACE_DIST = 2; // CategorizePosition trace-down distance
