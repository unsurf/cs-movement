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

// -- Timed duck (CCSGameMovement::Duck) ------------------------------------
export const DUCK_SPEED_IDEAL = 8; // CS_PLAYER_DUCK_SPEED_IDEAL: duck-amount units per second
export const DUCK_SPEED_RECOVERY = 3; // m_flDuckSpeed regained per second
export const DUCK_SPEED_RECOVERY_FAR = 6; // ... per second once 64u from where full speed was last held
export const DUCK_SPEED_RECOVERY_DISTANCE = 64;
export const DUCK_SPAM_PENALTY = 2; // sv_crouch_spam_penalty: lost per duck-key press or release
export const DUCK_SPEED_MIN_ENABLED = 1.5; // below this the duck key is ignored (anti-spam)
export const DUCK_IN_SPEED_FACTOR = 0.8; // ducking is always a bit slower than unducking
export const UNDUCK_SPEED_MIN = 1.5; // never unduck slower than this
export const UNDUCK_FLAG_AMOUNT = 0.75; // FL_DUCKING drops once the unduck passes this
export const TIME_BETWEEN_DUCKS = 0.4; // sv_timebetweenducks, seconds
