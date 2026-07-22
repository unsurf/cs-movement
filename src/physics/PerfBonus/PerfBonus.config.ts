/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { PerfSettings } from './PerfBonus.types.js';

export const DEFAULT_PERF_SETTINGS: PerfSettings = {
  enabled: false,
  maxBhopFrames: 12, // sm_realbhop default, ~93.75ms at 128 tick
  framePenalty: 0.975, // sm_realbhop default, ~2.5% carry lost per frame late
  maxAirSpeed: 390, // observed nopre chasemod ceiling
  autobhopChance: 0.38, // observed nopre chasemod rate
};

// How gradually the ceiling is approached once air speed pushes past
// maxAirSpeed — not user-tunable (unlike maxAirSpeed itself), same tier as
// BHOP_MAX_SPEED_FACTOR. Lower = the ceiling bites harder/sooner. Applied
// every airborne tick in AirMove.ts (not just at the carry in Jump.ts) —
// capping only at takeoff let air-strafe gain between hops push the
// observed peak well past maxAirSpeed (empirically ~490-520 against a
// target of 390); capping continuously keeps the true asymptote (maxAirSpeed
// + this softness) as the actual observed ceiling, matching "never exceeds
// maxAirSpeed" for real.
export const AIR_SPEED_CEILING_SOFTNESS = 10;
