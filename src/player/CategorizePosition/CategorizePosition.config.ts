/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
export const NON_JUMP_VELOCITY = 140; // CategorizePosition: moving up faster than this is never "on ground" (gamemovement.cpp NON_JUMP_VELOCITY)
export const RISING_SURFACE_FRICTION = 0.25; // m_surfaceFriction while moving up with no valid ground below
/** PlayerMove: a walker moving up faster than this at the start of a tick is lifted off the ground before anything else. */
export const START_OF_TICK_LIFTOFF_VELOCITY = 250;
export const GROUND_TRACE_DIST = 2; // CategorizePosition trace-down distance
/**
 * Hull quadrants for the fallback ground trace (TracePlayerBBoxForGround).
 * Each entry is [clampMinX, clampMinZ, clampMaxX, clampMaxZ]: 1 means that
 * bound is pulled in to the hull centre (0), 0 leaves it at the hull edge.
 * Order matches the C++: (-x,-z), (+x,+z), (-x,+z), (+x,-z).
 */
export const QUADRANTS = [
  [0, 0, 1, 1],
  [1, 1, 0, 0],
  [0, 1, 1, 0],
  [1, 0, 0, 1],
] as const;
