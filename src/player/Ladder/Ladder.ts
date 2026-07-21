/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { cross, dot, length, normalize, scale, set, vec3 } from '../../math/vec3.js';
import type { LadderVolume } from '../../physics/Collision/Collision.types.js';
import { DEG2RAD, type MovementContext } from '../MovementContext.js';
import { tryPlayerMove } from '../TryPlayerMove/TryPlayerMove.js';
import { LADDER_JUMP_OFF_SPEED, LADDER_SPEED } from './Ladder.config.js';

export function checkLadder(ctx: MovementContext): LadderVolume | null {
  if (ctx.ladderCooldown > 0) return null;
  const ladder = ctx.world.ladderAt(ctx.origin, ctx.mins, ctx.maxs);
  if (!ladder) return null;
  if (ctx.onLadder) return ladder; // already gripping — keep it

  // Only grab when airborne, or when deliberately walking into the ladder.
  if (!ctx.onGround) return ladder;
  const yawRad = ctx.yaw * DEG2RAD;
  const facingDot = -Math.sin(yawRad) * -ladder.facing.x + -Math.cos(yawRad) * -ladder.facing.z;
  if (ctx.input.forward && facingDot > 0.3) return ladder;
  return null;
}

export function ladderMove(ctx: MovementContext, dt: number, ladder: LadderVolume): void {
  ctx.onLadder = ladder;
  ctx.onGround = false;
  ctx.fallVelocity = 0;

  // Jump off: push away from the ladder face.
  if (ctx.input.jump && !ctx.oldJump) {
    scale(ctx.velocity, ladder.facing, LADDER_JUMP_OFF_SPEED);
    ctx.ladderCooldown = 0.25;
    ctx.onLadder = null;
    tryPlayerMove(ctx, dt);
    return;
  }

  const fmove = (ctx.input.forward ? 1 : 0) - (ctx.input.back ? 1 : 0);
  const smove = (ctx.input.right ? 1 : 0) - (ctx.input.left ? 1 : 0);

  // Full 3D view basis — looking up + forward climbs up, looking down descends.
  const yawRad = ctx.yaw * DEG2RAD;
  const pitchRad = ctx.pitch * DEG2RAD;
  const cp = Math.cos(pitchRad);
  const fwd = set(ctx.tmpA, -Math.sin(yawRad) * cp, Math.sin(pitchRad), -Math.cos(yawRad) * cp);
  const right = set(ctx.tmpB, Math.cos(yawRad), 0, -Math.sin(yawRad));

  // Each input axis contributes its FULL climb-speed scale — deliberately
  // not normalized, exactly like Source. This is what makes CS:GO
  // fastclimb work: aiming diagonally into the ladder and holding
  // W+strafe stacks both contributions for ~1.41x climb speed.
  const wish = ctx.wishDir;
  set(
    wish,
    (fwd.x * fmove + right.x * smove) * LADDER_SPEED,
    (fwd.y * fmove + right.y * smove) * LADDER_SPEED,
    (fwd.z * fmove + right.z * smove) * LADDER_SPEED,
  );
  const wlen = length(wish);
  if (wlen === 0) {
    set(ctx.velocity, 0, 0, 0);
    return;
  }
  // Cap at the authentic fastclimb maximum (sqrt2 x climb speed).
  const maxWish = LADDER_SPEED * Math.SQRT2;
  if (wlen > maxWish) scale(wish, wish, maxWish / wlen);

  // Split the wish into lateral (along the ladder plane) and into-wall
  // parts; redirect the into-wall part along the ladder's climb direction.
  const n = ladder.facing;
  const normalVel = dot(wish, n);
  const lateral = set(ctx.tmpA, wish.x - n.x * normalVel, wish.y - n.y * normalVel, wish.z - n.z * normalVel);

  const up = set(ctx.tmpB, 0, 1, 0);
  const along = cross(vec3(), n, up); // horizontal, along the wall
  const climbDir = cross(vec3(), along, n); // straight up the ladder face
  normalize(climbDir);

  set(
    ctx.velocity,
    lateral.x + climbDir.x * -normalVel,
    lateral.y + climbDir.y * -normalVel,
    lateral.z + climbDir.z * -normalVel,
  );

  tryPlayerMove(ctx, dt);
}
