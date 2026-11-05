/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (cstrike15_src@f82112a, game/shared/gamemovement.cpp): CGameMovement::StartGravity / FinishGravity

import { GRAVITY } from '../../constants.js';
import { checkVelocity } from '../CheckVelocity/CheckVelocity.js';
import type { MovementContext } from '../MovementContext.js';

/**
 * Half of this tick's gravity, applied BEFORE the move so the position
 * integrates with the mid-tick velocity. Source runs this on every walking
 * tick — including grounded ones, where the grounded branch then zeroes
 * vertical velocity again before friction. Mirroring that exactly is what
 * makes a ledge walk-off and a standing jump launch with Source's numbers.
 */
export function startGravity(ctx: MovementContext, dt: number): void {
  ctx.velocity.y -= 0.5 * GRAVITY * dt;
  checkVelocity(ctx.velocity);
}

/** The other half of gravity, applied after the move and categorize. */
export function finishGravity(ctx: MovementContext, dt: number): void {
  ctx.velocity.y -= 0.5 * GRAVITY * dt;
  checkVelocity(ctx.velocity);
}
