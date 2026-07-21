/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// All values are in Source engine units (1 unit = 1 inch) and match CS:GO's
// actual gameplay cvars. Axis note: this project uses Three.js Y-up, so
// Source's vertical `z` axis maps to `y` everywhere here.
//
// Only genuinely cross-behavior constants live here — everything else moved
// into the .config.ts of the single feature folder that owns it.

// -- Cvars --------------------------------------------------------------
export const GRAVITY = 800; // sv_gravity, u/s^2
export const RUN_SPEED = 250; // knife/no-weapon speed, practical max
export const WALK_SPEED = 130; // +speed (shift) — flat value, not a %
export const CROUCH_SPEED = 85; // ~CROUCH_SPEED_FACTOR of 250

// -- Movement mechanics ---------------------------------------------------
// Used by StepMove, StayOnGround, TryPlayerMove, and CategorizePosition alike.
export const STANDABLE_NORMAL = 0.7; // ground iff normal.y >= 0.7 (~45.57°); steeper = surf

// -- Simulation -------------------------------------------------------------
export const DEFAULT_TICK_RATE = 128;
export const MAX_FRAME_TIME = 0.1; // clamp rAF delta to avoid spiral of death
