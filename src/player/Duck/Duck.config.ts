/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
export const HULL_HALF_WIDTH = 16; // 32x32 footprint
export const HULL_STAND_HEIGHT = 72;
export const HULL_DUCK_HEIGHT = 54;
export const EYE_STAND = 64.09;
export const EYE_DUCK = 46.04;
export const DUCK_LERP_TIME = 0.2; // seconds, eye-height transition
/**
 * Airborne duck/unduck moves the feet by half the hull-height difference
 * (CCSGameMovement::FinishDuck / FinishUnDuck: viewDelta = -0.5 * (stand hull
 * size - duck hull size)). Ducking in the air pulls the feet up 9; unducking
 * puts them back down 9. On the ground (or a ladder) the hull mins are
 * identical, so nothing moves.
 */
export const AIR_DUCK_ORIGIN_SHIFT = (HULL_STAND_HEIGHT - HULL_DUCK_HEIGHT) / 2;
/** FixPlayerCrouchStuck: how far up (1u steps) to look for free space after ducking embeds the hull. */
export const CROUCH_STUCK_MAX_STEPS = 36;
