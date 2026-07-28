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
 * Flat one-time horizontal distance credit for ducking at any point during
 * an airborne jump (the "duck-jump"/longjump technique). This is NOT derived
 * from the public Source SDK: real Source's SetDuckedEyeOffset only ever
 * writes the view/camera offset, and the default hull mins are identical
 * standing vs ducked, so nothing in the shared SDK code produces a distance
 * bonus from ducking (see Duck.ts). CS:GO's own game-movement code is
 * closed-source, but real play measurably gives a duck-held longjump ~9
 * units more than a no-duck jump on this engine's baseline (219.5u -> 225u,
 * confirmed against actual CS:GO reference numbers). This constant is a
 * deliberate, labeled approximation of that unavailable behavior, not a
 * reverse-engineered mechanic — treat it as calibration, not physics.
 */
export const DUCK_LANDING_BONUS = 5.5; // raw horizontal units
