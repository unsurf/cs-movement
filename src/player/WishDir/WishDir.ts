/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { normalize, set } from '../../math/vec3.js';
import { currentMaxSpeed } from '../CurrentMaxSpeed/CurrentMaxSpeed.js';
import { forwardAxis, sideAxis } from '../MoveAxes/MoveAxes.js';
import { DEG2RAD, type MovementContext } from '../MovementContext.js';

/** Horizontal wish direction from WASD (or analog axes) + yaw, written into ctx.wishDir. Returns wishspeed. */
export function computeWish(ctx: MovementContext): number {
  const fmove = forwardAxis(ctx.input);
  const smove = sideAxis(ctx.input);
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
