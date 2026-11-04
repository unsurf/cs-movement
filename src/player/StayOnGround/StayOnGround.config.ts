/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
export const STAY_ON_GROUND_LIFT = 2; // trace up this far first, to start from a known-safe spot
export const COORD_RESOLUTION = 1 / 32; // network coordinate quantum (coordsize.h, COORD_FRACTIONAL_BITS 5)
/** Snaps smaller than this are skipped: below half a network quantum it can't even be sent. */
export const MIN_GROUND_SNAP = 0.5 * COORD_RESOLUTION;
