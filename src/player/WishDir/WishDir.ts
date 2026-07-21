/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { normalize, set } from '../../math/vec3.js';
import { currentMaxSpeed } from '../CurrentMaxSpeed/CurrentMaxSpeed.js';
import { DEG2RAD, type MovementContext } from '../MovementContext.js';

/** Horizontal wish direction from WASD + yaw, written into ctx.wishDir. Returns wishspeed. */
export function computeWish(ctx: MovementContext): number {
  const fmove = (ctx.input.forward ? 1 : 0) - (ctx.input.back ? 1 : 0);
  const smove = (ctx.input.right ? 1 : 0) - (ctx.input.left ? 1 : 0);
  const yawRad = ctx.yaw * DEG2RAD;
  const fx = -Math.sin(yawRad);
  const fz = -Math.cos(yawRad);
  const rx = Math.cos(yawRad);
  const rz = -Math.sin(yawRad);

  set(ctx.wishDir, fx * fmove + rx * smove, 0, fz * fmove + rz * smove);
  const maxspeed = currentMaxSpeed(ctx);
  const len = normalize(ctx.wishDir);
  return len > 0 ? Math.min(len * maxspeed, maxspeed) : 0;
}
