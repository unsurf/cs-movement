/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 Liam Grant
 * SPDX-License-Identifier: Apache-2.0
 */
// All values are in Source engine units (1 unit = 1 inch) and match CS:GO's
// actual gameplay cvars. Axis note: this project uses Three.js Y-up, so
// Source's vertical `z` axis maps to `y` everywhere here.

// -- Cvars ------------------------------------------------------------------
export const GRAVITY = 800; // sv_gravity, u/s^2
export const RUN_SPEED = 250; // knife/no-weapon speed, practical max
export const WALK_SPEED = 130; // +speed (shift) — flat value, not a %
export const CROUCH_SPEED = 85; // ~CROUCH_SPEED_FACTOR of 250
export const ACCELERATE = 10; // sv_accelerate
export const AIR_ACCELERATE = 100; // sv_airaccelerate (KZ/HNS-server value; CS:GO default is 12)
export const FRICTION = 4; // sv_friction
export const STOP_SPEED = 100; // sv_stopspeed
export const AIR_SPEED_CAP = 30; // wishspeed clamp while airborne
export const JUMP_HEIGHT = 57; // jump apex, units
export const JUMP_VELOCITY = Math.sqrt(2 * GRAVITY * JUMP_HEIGHT); // ≈ 301.993
// sv_enablebunnyhopping 0 ("nopre"): horizontal speed is clamped to
// 1.1 × maxspeed on every takeoff, so hops cruise ~275 instead of gaining
// unboundedly.
export const BHOP_MAX_SPEED_FACTOR = 1.1;

// -- Hull / eye -------------------------------------------------------------
export const HULL_HALF_WIDTH = 16; // 32x32 footprint
export const HULL_STAND_HEIGHT = 72;
export const HULL_DUCK_HEIGHT = 54;
export const EYE_STAND = 64.09;
export const EYE_DUCK = 46.04;
export const DUCK_LERP_TIME = 0.2; // seconds, eye-height transition

// -- Movement mechanics -----------------------------------------------------
export const STEP_HEIGHT = 18;
export const STANDABLE_NORMAL = 0.7; // ground iff normal.y >= 0.7 (~45.57°); steeper = surf
export const NON_JUMP_VELOCITY = 180; // don't re-ground while moving up faster than this
export const GROUND_TRACE_DIST = 2; // CategorizePosition trace-down distance
export const MAX_CLIP_PLANES = 5;
export const OVERBOUNCE_SURF = 1.0; // preserves speed on surf ramps
export const OVERBOUNCE_DEFAULT = 1.001; // ordinary geometry clipping

// -- Ladders ----------------------------------------------------------------
export const LADDER_SPEED = 200; // fixed climb speed
export const LADDER_JUMP_OFF_SPEED = 270; // push away from ladder on jump

// -- Input ------------------------------------------------------------------
export const M_YAW = 0.022; // deg per count, matches m_yaw/m_pitch
export const PITCH_CLAMP = 89;

// -- Simulation -------------------------------------------------------------
export const DEFAULT_TICK_RATE = 128;
export const MAX_FRAME_TIME = 0.1; // clamp rAF delta to avoid spiral of death

// -- Collision --------------------------------------------------------------
export const DIST_EPSILON = 0.03125; // Source's trace epsilon (1/32 unit)
