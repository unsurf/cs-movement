/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Real bhop-assist velocity carry (the mechanic actual bhop/chasemod
 * SourceMod plugins run, e.g. sm_realbhop) — not a synthetic speed
 * multiplier. On landing, your horizontal velocity is snapshotted
 * (`MovementContext.landingVelocity`). Rejump within `maxBhopFrames` ticks
 * and your takeoff velocity gets blended back toward that snapshot:
 *
 *   velocity += (landingVelocity - velocity) * framePenalty^framesTooLate
 *
 * At 0 ticks late the weight is 1 (full carry — a "perfect" hop). It decays
 * every tick you wait, and past `maxBhopFrames` nothing happens at all: the
 * takeoff is whatever `settings.bhopSpeedClamp` (vanilla
 * PreventBunnyJumping) already left it at, i.e. clamped to ~1.1x maxspeed.
 * There's no separate mode for autobhop — held jump always re-fires at 0
 * ticks late, so it's deterministically always a "perfect" carry, exactly
 * like a real bhop-assist server: autobhop is easy mode, not a coin flip.
 */
export interface PerfSettings {
  enabled: boolean;
  maxBhopFrames: number; // ticks after landing a rejump can still carry velocity; sm_realbhop default 12
  framePenalty: number; // per-frame-late decay toward 0 carry; sm_realbhop default 0.975
}
