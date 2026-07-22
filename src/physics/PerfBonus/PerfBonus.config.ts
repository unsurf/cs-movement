/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { PerfSettings } from './PerfBonus.types.js';

export const DEFAULT_PERF_SETTINGS: PerfSettings = {
  enabled: false,
  maxAirSpeed: 390, // observed nopre chasemod ceiling
};

// How gradually the ceiling is approached once air speed pushes past
// maxAirSpeed — not user-tunable (unlike maxAirSpeed itself), same tier as
// BHOP_MAX_SPEED_FACTOR. Lower = the ceiling bites harder/sooner. Applied
// every airborne tick in AirMove.ts so a chain can't compound past it via
// air-strafe gain between hops.
export const AIR_SPEED_CEILING_SOFTNESS = 10;
