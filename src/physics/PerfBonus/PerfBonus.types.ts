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
 *
 * Held-jump autobhop always re-fires at 0 ticks late — the frame-timing
 * math above would treat that as a guaranteed "perfect" every single hop,
 * which permanently defeats bhopSpeedClamp: the carry restores whatever you
 * landed with every time, so the clamp never gets a tick to actually hold
 * speed down (confirmed against real nopre servers: holding autobhop with
 * bhopSpeedClamp on should float around baseline run speed, not sit high).
 * So under `autobhop`, each hop instead rolls `autobhopChance` for whether
 * it gets a full ('perfect') carry at all; on a miss, no carry happens and
 * the takeoff is left at whatever bhopSpeedClamp already set it to. Manual
 * (non-autobhop) rejumps keep the deterministic frame-timing carry above —
 * real reflexes hitting frame 0 repeatedly is a skill, not a triviality.
 *
 * Chaining hits with real air-strafe technique otherwise climbs indefinitely
 * (each perfect hop can add more speed on top of the last), which isn't how
 * real chasemod servers feel in practice — players report air speed never
 * exceeding `maxAirSpeed` (unless surfing, a different physics path via
 * ramp geometry). So whenever `enabled`, AirMove.ts squeezes air speed
 * itself through a diminishing-returns curve every airborne tick — not just
 * at the carry — that approaches `maxAirSpeed` but never quite reaches it:
 * gains shrink the closer you already are to the ceiling, rather than being
 * flatly clamped. Speeds at or below `maxAirSpeed` are left untouched.
 */
export interface PerfSettings {
  enabled: boolean;
  maxBhopFrames: number; // ticks after landing a rejump can still carry velocity; sm_realbhop default 12
  framePenalty: number; // per-frame-late decay toward 0 carry; sm_realbhop default 0.975
  maxAirSpeed: number; // asymptotic ceiling a perf carry approaches; observed ~390 on nopre chasemod servers
  autobhopChance: number; // 0..1, per-hop chance of a full carry under autobhop; observed ~0.38
}
