/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { STANDABLE_NORMAL } from '../../constants.js';
import { copy, set, vec3, type Vec3 } from '../../math/vec3.js';
import type { TraceResult } from '../../physics/Collision/Collision.types.js';
import { addStamina } from '../../physics/Stamina/Stamina.js';
import type { MovementContext } from '../MovementContext.js';
import { STEP_HEIGHT } from '../StepMove/StepMove.config.js';
import { GROUND_TRACE_DIST, NON_JUMP_VELOCITY, QUADRANTS, RISING_SURFACE_FRICTION } from './CategorizePosition.config.js';

// Scratch, reused every call (categorizePosition is not re-entrant).
const mainEndPos = vec3();
const quadMins = vec3();
const quadMaxs = vec3();

function setNotGrounded(ctx: MovementContext): void {
  ctx.onGround = false;
  // CategorizePosition: no valid ground while still moving up (e.g. rising
  // along a surf ramp, or the last stretch of a jump) cuts surface friction
  // to 0.25, which AirAccelerate multiplies into next tick's air acceleration.
  if (ctx.velocity.y > 0) ctx.surfaceFriction = RISING_SURFACE_FRICTION;
}

/** The hit plane, if the trace landed on something walkable. */
function standableNormal(tr: TraceResult): Vec3 | null {
  if (tr.fraction >= 1 || tr.startSolid || tr.normal === null) return null;
  return tr.normal.y >= STANDABLE_NORMAL ? tr.normal : null;
}

/**
 * TracePlayerBBoxForGround: retry the ground trace with each horizontal
 * quadrant of the hull (Source x/y here are our x/z; the vertical extent is
 * untouched). Returns the first walkable quadrant hit's plane.
 */
function traceQuadrants(ctx: MovementContext, traceDist: number): Vec3 | null {
  const { mins, maxs } = ctx;
  const end = set(ctx.tmpA, ctx.origin.x, ctx.origin.y - traceDist, ctx.origin.z);
  for (const [loX, loZ, hiX, hiZ] of QUADRANTS) {
    set(
      quadMins,
      loX ? Math.max(0, mins.x) : mins.x,
      mins.y,
      loZ ? Math.max(0, mins.z) : mins.z,
    );
    set(
      quadMaxs,
      hiX ? Math.min(0, maxs.x) : maxs.x,
      maxs.y,
      hiZ ? Math.min(0, maxs.z) : maxs.z,
    );
    const normal = standableNormal(ctx.world.trace(ctx.origin, end, quadMins, quadMaxs, ctx.traceResult));
    if (normal !== null) return normal;
  }
  return null;
}

export function categorizePosition(ctx: MovementContext): void {
  ctx.surfaceFriction = 1;

  // Moving up faster than this and we can't be "on" anything.
  if (ctx.velocity.y > NON_JUMP_VELOCITY) {
    ctx.onGround = false;
    return;
  }

  // Previously grounded: look STEP_HEIGHT further down and follow the ground,
  // so walking down slopes/stairs doesn't pop into the air.
  const wasOnGround = ctx.onGround;
  const traceDist = wasOnGround ? GROUND_TRACE_DIST + STEP_HEIGHT : GROUND_TRACE_DIST;
  const tr = ctx.world.trace(
    ctx.origin,
    set(ctx.tmpA, ctx.origin.x, ctx.origin.y - traceDist, ctx.origin.z),
    ctx.mins,
    ctx.maxs,
    ctx.traceResult,
  );
  const mainFraction = tr.fraction;
  const mainStartSolid = tr.startSolid;
  copy(mainEndPos, tr.endPos);

  let normal = standableNormal(tr);
  // The full hull hit something too steep to stand on: a hull corner
  // overhanging a ramp edge may still rest on a walkable plane. (Skipped when
  // the full hull hit nothing — its sub-boxes cannot either.)
  if (normal === null && mainFraction < 1 && !mainStartSolid) normal = traceQuadrants(ctx, traceDist);

  if (normal === null) {
    setNotGrounded(ctx);
    return;
  }

  // Only a player who was already on the ground is snapped down to it; a
  // landing keeps the position the move left it at.
  if (wasOnGround && mainFraction > 0 && mainFraction < 1) copy(ctx.origin, mainEndPos);
  copy(ctx.groundNormal, normal);
  ctx.onGround = true;
  if (!wasOnGround) {
    ctx.groundTicksSinceLanding = 0;
    // Only y gets clipped by the floor plane's normal this tick — x/z still
    // hold the actual speed the player landed with. Snapshot it now, before
    // walkMove's friction gets a chance to bleed it, so a perfect rejump
    // has something real to carry back to (see PerfBonus).
    set(ctx.landingVelocity, ctx.velocity.x, ctx.velocity.y, ctx.velocity.z);
    // OnLand: landing cost scales with how fast the player was falling.
    if (ctx.settings.stamina.enabled && ctx.fallVelocity > 0) {
      const { landCost, max } = ctx.settings.stamina;
      ctx.stamina = addStamina(ctx.stamina, landCost * ctx.fallVelocity, max);
    }
    if (ctx.settings.viewPunch && ctx.fallVelocity > 250) {
      ctx.landPunch = Math.min((ctx.fallVelocity - 250) * 0.012, 10);
    }
  }
  ctx.fallVelocity = 0;
}
