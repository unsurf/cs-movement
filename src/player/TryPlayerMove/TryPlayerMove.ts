/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (cstrike15_src@f82112a, game/shared/gamemovement.cpp): CGameMovement::TryPlayerMove

import { copy, cross, dot, lengthSq, normalize, scale, addScaled, set, vec3, type Vec3 } from '../../math/vec3.js';
import { STANDABLE_NORMAL } from '../../constants.js';
import { clipVelocity } from '../../physics/ClipVelocity/ClipVelocity.js';
import { OVERBOUNCE } from '../../physics/ClipVelocity/ClipVelocity.config.js';
import type { MovementContext } from '../MovementContext.js';
import {
  EFFECTIVELY_VERTICAL_NORMAL_Y,
  MAX_CLIP_PLANES,
  MINIMUM_MOVE_FRACTION,
  NUM_BUMPS,
} from './TryPlayerMove.config.js';

// Scratch state, reused every call (tryPlayerMove is not re-entrant).
const planePool: Vec3[] = Array.from({ length: MAX_CLIP_PLANES }, () => vec3());
const originalVel = vec3();
const primalVel = vec3();

/**
 * Source's TryPlayerMove: sweep, clip velocity against every plane touched
 * this tick (creases slide along the shared edge), repeat up to 4 bumps.
 */
export function tryPlayerMove(ctx: MovementContext, dt: number): void {
  let timeLeft = dt;
  let planeCount = 0;
  let allFraction = 0;
  copy(originalVel, ctx.velocity);
  copy(primalVel, ctx.velocity);
  ctx.surfing = false;

  for (let bump = 0; bump < NUM_BUMPS; bump++) {
    if (lengthSq(ctx.velocity) === 0) break;

    addScaled(ctx.moveEnd, ctx.origin, ctx.velocity, timeLeft);
    const tr = ctx.world.trace(ctx.origin, ctx.moveEnd, ctx.mins, ctx.maxs, ctx.traceResult);

    // Extremely tiny move fractions wreck the later distance maths.
    if (tr.fraction > 0 && tr.fraction < MINIMUM_MOVE_FRACTION) tr.fraction = 0;
    allFraction += tr.fraction;

    if (tr.allSolid) {
      ctx.log('tryPlayerMove: allSolid — velocity zeroed');
      set(ctx.velocity, 0, 0, 0);
      return;
    }
    if (tr.fraction > 0) {
      copy(ctx.origin, tr.endPos);
      copy(originalVel, ctx.velocity);
      planeCount = 0;
    }
    if (tr.fraction === 1) break;

    const n = tr.normal;
    if (n === null) break;
    ctx.contactsThisTick.push(n, tr.fraction);

    timeLeft -= timeLeft * tr.fraction;

    if (planeCount >= MAX_CLIP_PLANES) {
      ctx.log('tryPlayerMove: exceeded MAX_CLIP_PLANES — velocity zeroed');
      set(ctx.velocity, 0, 0, 0);
      return;
    }
    const plane = copy(planePool[planeCount++], n);
    // A plane that is vertical to within float noise is exactly vertical.
    if (Math.abs(plane.y) < EFFECTIVELY_VERTICAL_NORMAL_Y) plane.y = 0;
    if (n.y > 0.05 && n.y < STANDABLE_NORMAL) ctx.surfing = true;

    if (planeCount === 1 && !ctx.onGround && ctx.onLadder === null) {
      // First impact of an airborne walker: clip the velocity against this
      // one plane and carry on. No multi-plane search and no "stopped dead"
      // test here — exactly like Source, which only reflects off the first
      // plane (bounce is 0, so this is a plain slide).
      clipVelocity(ctx.velocity, plane, OVERBOUNCE);
      copy(originalVel, ctx.velocity);
      continue;
    }

    // Find a clip of the original velocity that doesn't re-enter any plane.
    let i = 0;
    for (; i < planeCount; i++) {
      copy(ctx.velocity, originalVel);
      clipVelocity(ctx.velocity, planePool[i], OVERBOUNCE);
      let ok = true;
      for (let j = 0; j < planeCount; j++) {
        if (j !== i && dot(ctx.velocity, planePool[j]) < 0) {
          ok = false;
          break;
        }
      }
      if (ok) break;
    }

    if (i === planeCount) {
      // No single plane worked — slide along the crease of the first two.
      if (planeCount !== 2) {
        ctx.log(`tryPlayerMove: cornered by ${planeCount} planes — velocity zeroed`);
        set(ctx.velocity, 0, 0, 0);
        break;
      }
      cross(ctx.tmpB, planePool[0], planePool[1]);
      normalize(ctx.tmpB);
      scale(ctx.velocity, ctx.tmpB, dot(ctx.tmpB, ctx.velocity));
    }

    // If we've been deflected back on ourselves, stop dead (prevents
    // oscillating in corners).
    if (dot(ctx.velocity, primalVel) <= 0) {
      set(ctx.velocity, 0, 0, 0);
      break;
    }
  }

  // Never got anywhere this tick at all: nothing to carry.
  if (allFraction === 0) set(ctx.velocity, 0, 0, 0);
}
