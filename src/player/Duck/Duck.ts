/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (cstrike15_src@f82112a, game/shared/cstrike15/cs_gamemovement.cpp):
// CCSGameMovement::Duck / FinishDuck / FinishUnDuck / CanUnduck

import { set, vec3 } from '../../math/vec3.js';
import type { MovementContext } from '../MovementContext.js';
import {
  AIR_DUCK_ORIGIN_SHIFT,
  CROUCH_STUCK_MAX_STEPS,
  DUCK_IN_SPEED_FACTOR,
  DUCK_SPAM_PENALTY,
  DUCK_SPEED_IDEAL,
  DUCK_SPEED_MIN_ENABLED,
  DUCK_SPEED_RECOVERY,
  DUCK_SPEED_RECOVERY_DISTANCE,
  DUCK_SPEED_RECOVERY_FAR,
  HULL_DUCK_HEIGHT,
  HULL_HALF_WIDTH,
  HULL_STAND_HEIGHT,
  TIME_BETWEEN_DUCKS,
  UNDUCK_FLAG_AMOUNT,
  UNDUCK_SPEED_MIN,
} from './Duck.config.js';

export const STAND_MINS = vec3(-HULL_HALF_WIDTH, 0, -HULL_HALF_WIDTH);
export const STAND_MAXS = vec3(HULL_HALF_WIDTH, HULL_STAND_HEIGHT, HULL_HALF_WIDTH);
export const DUCK_MINS = vec3(-HULL_HALF_WIDTH, 0, -HULL_HALF_WIDTH);
export const DUCK_MAXS = vec3(HULL_HALF_WIDTH, HULL_DUCK_HEIGHT, HULL_HALF_WIDTH);

/** Airborne = no ground and not gripping a ladder (the only states where duck moves the feet). */
function isAirborne(ctx: MovementContext): boolean {
  return !ctx.onGround && ctx.onLadder === null;
}

/** FixPlayerCrouchStuck(upward): if the new hull is embedded, nudge up 1u at a time (max 36) until free. */
function fixCrouchStuck(ctx: MovementContext): void {
  if (ctx.world.isPositionFree(ctx.origin, ctx.mins, ctx.maxs)) return;
  const startY = ctx.origin.y;
  for (let i = 0; i < CROUCH_STUCK_MAX_STEPS; i++) {
    ctx.origin.y += 1;
    if (ctx.world.isPositionFree(ctx.origin, ctx.mins, ctx.maxs)) return;
  }
  ctx.origin.y = startY; // failed: leave the player where they were
}

/**
 * CanUnduck: the standing hull must fit. On the ground that is the current
 * position; in the air the unduck also drops the feet by 9, so the standing
 * hull has to sweep clear over that whole path.
 */
function canUnduck(ctx: MovementContext): boolean {
  if (!isAirborne(ctx)) return ctx.world.isPositionFree(ctx.origin, STAND_MINS, STAND_MAXS);
  set(ctx.tmpA, ctx.origin.x, ctx.origin.y - AIR_DUCK_ORIGIN_SHIFT, ctx.origin.z);
  const tr = ctx.world.trace(ctx.origin, ctx.tmpA, STAND_MINS, STAND_MAXS, ctx.traceResult);
  return !tr.startSolid && tr.fraction === 1;
}

/** Valve's Approach(): move `value` toward `target` by at most `step`. */
function approach(target: number, value: number, step: number): number {
  const delta = target - value;
  if (delta > step) return value + step;
  if (delta < -step) return value - step;
  return target;
}

/** Anti duck-spam: ignore the key while the duck speed is spent or right after finishing a duck. */
function duckingEnabled(ctx: MovementContext): boolean {
  if (ctx.duckSpeed < DUCK_SPEED_MIN_ENABLED) return false;
  return ctx.duckFlag || ctx.time >= ctx.lastDuckTime + TIME_BETWEEN_DUCKS;
}

function finishDuck(ctx: MovementContext): void {
  // In the air the feet come up by half the hull-height delta.
  if (isAirborne(ctx)) ctx.origin.y += AIR_DUCK_ORIGIN_SHIFT;
  ctx.ducked = true;
  ctx.ducking = false;
  ctx.duckFlag = true;
  ctx.duckFrac = 1;
  ctx.lastDuckTime = ctx.time;
  fixCrouchStuck(ctx);
}

function finishUnduck(ctx: MovementContext): void {
  if (isAirborne(ctx)) ctx.origin.y -= AIR_DUCK_ORIGIN_SHIFT;
  ctx.ducked = false;
  ctx.ducking = false;
  ctx.duckFlag = false;
  ctx.duckFrac = 0;
}

/**
 * CCSGameMovement::Duck. Ducking is timed on the ground: the duck amount
 * ramps toward 1 at `duckSpeed * 0.8` per second and the hull only switches
 * to the ducked one when it arrives (or immediately if airborne); unducking
 * ramps back at `max(1.5, duckSpeed)` and the standing hull returns as soon as
 * it is allowed to start. The max-speed crop follows the amount (see
 * CurrentMaxSpeed). Mashing the key burns `duckSpeed`, which recovers over
 * time and gates the key off entirely when depleted.
 */
export function updateDuck(ctx: MovementContext, dt: number): void {
  // CheckParameters: spam penalty on every raw press/release, then the filter.
  const raw = ctx.input.duck;
  if (raw !== ctx.rawDuckPrev) ctx.duckSpeed = Math.max(0, ctx.duckSpeed - DUCK_SPAM_PENALTY);
  ctx.rawDuckPrev = raw;
  const held = raw && duckingEnabled(ctx);
  ctx.duckHeld = held;

  ctx.duckSpeed = approach(DUCK_SPEED_IDEAL, ctx.duckSpeed, dt * DUCK_SPEED_RECOVERY);
  if (ctx.duckSpeed >= DUCK_SPEED_IDEAL) {
    ctx.fullDuckX = ctx.origin.x;
    ctx.fullDuckZ = ctx.origin.z;
  } else if (ctx.duckFrac <= 0 || ctx.duckFrac >= 1) {
    // Far from where full duck speed was last held: regain it faster.
    const dx = ctx.origin.x - ctx.fullDuckX;
    const dz = ctx.origin.z - ctx.fullDuckZ;
    if (dx * dx + dz * dz > DUCK_SPEED_RECOVERY_DISTANCE * DUCK_SPEED_RECOVERY_DISTANCE) {
      ctx.duckSpeed = approach(DUCK_SPEED_IDEAL, ctx.duckSpeed, dt * DUCK_SPEED_RECOVERY_FAR);
    }
  }

  if (!held && ctx.duckFrac > 0) ctx.ducking = true;
  else if (held && ctx.duckFrac < 1) ctx.ducking = true;

  if (held && ctx.ducking) {
    ctx.duckFrac = approach(1, ctx.duckFrac, dt * ctx.duckSpeed * DUCK_IN_SPEED_FACTOR);
    if (ctx.duckFrac >= 1 || !ctx.onGround) finishDuck(ctx);
  }

  if (!held && ctx.ducking) {
    if (canUnduck(ctx)) {
      ctx.duckFrac = approach(0, ctx.duckFrac, dt * Math.max(UNDUCK_SPEED_MIN, ctx.duckSpeed));
      ctx.ducked = false;
      if (ctx.duckFrac <= 0 || !ctx.onGround) finishUnduck(ctx);
      if (ctx.duckFrac <= UNDUCK_FLAG_AMOUNT) ctx.duckFlag = false;
    } else {
      // Something overhead: snap back to fully ducked and retry later.
      ctx.duckFrac = 1;
      ctx.ducked = true;
      ctx.ducking = false;
      ctx.duckFlag = true;
    }
  }
}
