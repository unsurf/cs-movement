/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (cstrike15_src@f82112a, game/shared/gamemovement.cpp and cs_gamemovement.cpp):
// CGameMovement::LadderMove + CCSGameMovement::ClimbSpeed.
// Attachment differs on purpose: Source traces a 2u hull toward the wish
// direction for a CONTENTS_LADDER brush; this library uses LadderVolume overlap.

import { forwardAxis, sideAxis } from '../MoveAxes/MoveAxes.js';
import { cross, dot, normalize, scale, set, vec3 } from '../../math/vec3.js';
import type { LadderVolume } from '../../physics/Collision/Collision.types.js';
import { DEG2RAD, type MovementContext } from '../MovementContext.js';
import { tryPlayerMove } from '../TryPlayerMove/TryPlayerMove.js';
import {
  LADDER_ANGLE,
  LADDER_DAMPEN,
  LADDER_IGNORE_JUMP_TIME,
  LADDER_JUMP_OFF_SPEED,
  LADDER_REGRIP_COOLDOWN,
  LADDER_SLOW_CLIMB_MODIFIER,
  LADDER_SPEED,
} from './Ladder.config.js';

const ZERO = vec3();
const UP = vec3(0, 1, 0);
// Scratch, reused every call (ladderMove is not re-entrant).
const perp = vec3();
const climbDir = vec3();
const lateral = vec3();
const angleVec = vec3();
const floorPoint = vec3();

export function checkLadder(ctx: MovementContext): LadderVolume | null {
  if (ctx.ladderCooldown > 0) return null;
  const ladder = ctx.world.ladderAt(ctx.origin, ctx.mins, ctx.maxs);
  if (!ladder) return null;
  if (ctx.onLadder) return ladder; // already gripping — keep it

  // Only grab when airborne, or when deliberately walking into the ladder.
  if (!ctx.onGround) return ladder;
  const yawRad = ctx.yaw * DEG2RAD;
  const facingDot = -Math.sin(yawRad) * -ladder.facing.x + -Math.cos(yawRad) * -ladder.facing.z;
  if (forwardAxis(ctx.input) > 0 && facingDot > 0.3) return ladder;
  return null;
}

/** CCSGameMovement::ClimbSpeed: crouching or walking up a ladder is slow. */
function climbSpeed(ctx: MovementContext): number {
  return ctx.duckHeld || ctx.input.walk ? LADDER_SPEED * LADDER_SLOW_CLIMB_MODIFIER : LADDER_SPEED;
}

/**
 * One tick of ladder movement. Returns true while the player stays on the
 * ladder; false when they jumped off, in which case velocity is already the
 * jump-off push and the caller runs the normal walk/air move for this tick
 * (Source switches movetype to WALK mid-LadderMove and falls into
 * FullWalkMove).
 */
export function ladderMove(ctx: MovementContext, dt: number, ladder: LadderVolume): boolean {
  const wasOnLadder = ctx.onLadder !== null;
  ctx.onLadder = ladder;
  if (!wasOnLadder) ctx.ladderJumpAllowedAt = ctx.time + LADDER_IGNORE_JUMP_TIME;

  // On the ground, or with solid directly under the feet.
  set(floorPoint, ctx.origin.x, ctx.origin.y + ctx.mins.y - 1, ctx.origin.z);
  const onFloor = ctx.onGround || !ctx.world.isPositionFree(floorPoint, ZERO, ZERO);
  ctx.onGround = false;
  ctx.fallVelocity = 0;

  const n = ladder.facing;

  if (ctx.input.jump) {
    // Level-triggered: holding jump leaves the ladder once the grab grace period is over.
    if (ctx.ladderJumpAllowedAt <= ctx.time) {
      scale(ctx.velocity, n, LADDER_JUMP_OFF_SPEED);
      ctx.ladderCooldown = LADDER_REGRIP_COOLDOWN;
      ctx.onLadder = null;
      return false;
    }
    // Within the grace period jump is simply ignored: velocity carries over.
  } else {
    const fmove = forwardAxis(ctx.input);
    const smove = sideAxis(ctx.input);
    if (fmove === 0 && smove === 0) {
      set(ctx.velocity, 0, 0, 0);
    } else {
      // Full 3D view basis — looking up + forward climbs up, looking down descends.
      const yawRad = ctx.yaw * DEG2RAD;
      const pitchRad = ctx.pitch * DEG2RAD;
      const cp = Math.cos(pitchRad);
      const fwd = set(ctx.tmpA, -Math.sin(yawRad) * cp, Math.sin(pitchRad), -Math.cos(yawRad) * cp);
      const right = set(ctx.tmpB, Math.cos(yawRad), 0, -Math.sin(yawRad));

      // Each input axis contributes its FULL climb speed — deliberately not
      // normalized, exactly like Source. This is what makes CS:GO fastclimb
      // work: aiming diagonally into the ladder and holding W+strafe stacks
      // both contributions for ~1.41x climb speed.
      const speed = climbSpeed(ctx);
      const wish = ctx.wishDir;
      set(
        wish,
        (fwd.x * fmove + right.x * smove) * speed,
        (fwd.y * fmove + right.y * smove) * speed,
        (fwd.z * fmove + right.z * smove) * speed,
      );

      // Split the wish into into-wall and lateral (along the ladder plane)
      // parts; redirect the into-wall part along the ladder's climb direction.
      const normalVel = dot(wish, n);
      set(lateral, wish.x - n.x * normalVel, wish.y - n.y * normalVel, wish.z - n.z * normalVel);
      cross(perp, UP, n);
      normalize(perp);
      cross(climbDir, n, perp);

      // CS: moving off the face at a steep angle gets its sideways drift damped.
      const tmpDist = dot(climbDir, lateral);
      const perpDist = dot(perp, lateral);
      set(
        angleVec,
        perp.x * perpDist + n.x * normalVel,
        perp.y * perpDist + n.y * normalVel,
        perp.z * perpDist + n.z * normalVel,
      );
      normalize(angleVec);
      if (dot(angleVec, n) < LADDER_ANGLE) {
        set(
          lateral,
          climbDir.x * tmpDist + perp.x * LADDER_DAMPEN * perpDist,
          climbDir.y * tmpDist + perp.y * LADDER_DAMPEN * perpDist,
          climbDir.z * tmpDist + perp.z * LADDER_DAMPEN * perpDist,
        );
      }

      set(
        ctx.velocity,
        lateral.x - normalVel * climbDir.x,
        lateral.y - normalVel * climbDir.y,
        lateral.z - normalVel * climbDir.z,
      );
      scale(ctx.velocity, ctx.velocity, ctx.settings.physics.ladderScaleSpeed);

      // Standing on the floor and moving away from the ladder: shove off it.
      if (onFloor && normalVel > 0) {
        ctx.velocity.x += n.x * LADDER_SPEED;
        ctx.velocity.y += n.y * LADDER_SPEED;
        ctx.velocity.z += n.z * LADDER_SPEED;
      }
    }
  }

  tryPlayerMove(ctx, dt);
  return true;
}
