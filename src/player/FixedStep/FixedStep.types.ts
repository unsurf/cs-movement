/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
export interface AdvanceResult {
  /** Fixed ticks simulated this call. */
  ticks: number;
  /** 0..1 progress into the next tick, for interpolate(). */
  alpha: number;
}

/** Render-time pose lerped between the last two ticks. */
export interface InterpolatedPose {
  x: number;
  y: number;
  z: number;
  eyeHeight: number;
}
