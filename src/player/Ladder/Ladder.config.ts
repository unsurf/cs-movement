/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
export const LADDER_SPEED = 200; // MAX_CLIMB_SPEED: base climb speed per input axis
export const LADDER_JUMP_OFF_SPEED = 270; // push away from ladder on jump
/** ClimbSpeed(): holding duck or walk climbs at this fraction (CS_PLAYER_SPEED_CLIMB_MODIFIER). */
export const LADDER_SLOW_CLIMB_MODIFIER = 0.34;
/** sv_ladder_scale_speed: final scale on every climb velocity. */
export const LADDER_SCALE_SPEED = 0.78;
/** sv_ladder_dampen: lateral drift is cut to this fraction when moving off the ladder face at a steep angle. */
export const LADDER_DAMPEN = 0.2;
/** sv_ladder_angle: cosine of the incidence angle below which LADDER_DAMPEN applies. */
export const LADDER_ANGLE = -0.707;
/** IGNORE_JUMP_TIME: seconds after grabbing a ladder during which jump is ignored. */
export const LADDER_IGNORE_JUMP_TIME = 0.2;
export const LADDER_REGRIP_COOLDOWN = 0.25; // seconds before the volume can re-grab after a jump-off (not in Source)
