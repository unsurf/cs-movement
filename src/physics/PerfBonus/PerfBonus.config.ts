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
};

// How gradually the ceiling is approached once a carry pushes speed past
// maxAirSpeed — not user-tunable (unlike maxAirSpeed itself), same tier as
// BHOP_MAX_SPEED_FACTOR. Lower = the ceiling bites harder/sooner.
//
// The squeeze only fires at the takeoff moment (the carry), not continuously
// while airborne — air-strafing between hops can still add real speed on
// top of a capped takeoff before the next landing. That per-hop gain is
// technique/airaccelerate-dependent and the squeeze has to out-pace it for
// an equilibrium to exist at all, so the actual observed ceiling settles
// somewhat above maxAirSpeed itself (empirically ~490-520 against
// maxAirSpeed=390 with this codebase's default airaccelerate and a
// continuous-turn strafe) rather than landing on it exactly. 10 keeps that
// gap as tight as reasonably possible without the curve turning into a hard
// clamp in disguise.
export const AIR_SPEED_CEILING_SOFTNESS = 10;
