/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { lengthSq, set } from '../../math/vec3.js';
import type { MovementContext } from '../MovementContext.js';

/**
 * Freeze breaker: no legitimate state has large velocity while the
 * position integrates nothing tick after tick — that pattern means the
 * mover is wedged against geometry in a way the clip loop can't resolve
 * (razor-thin float alignments at plane seams). Left alone it becomes a
 * runaway velocity accumulator (gravity keeps getting clip-converted while
 * the position is pinned). Detect it and dump the energy.
 */
export function detectBlockedMove(ctx: MovementContext): void {
  const speed = Math.sqrt(lengthSq(ctx.velocity));
  const moved = Math.hypot(
    ctx.origin.x - ctx.prevPos.x,
    ctx.origin.y - ctx.prevPos.y,
    ctx.origin.z - ctx.prevPos.z,
  );
  // "Blocked" means truly pinned: real slides move ~speed*dt (a unit or
  // more per tick); the freeze state moves nothing at all.
  if (!ctx.onGround && speed > 150 && moved < 0.05) {
    ctx.blockedTicks++;
    if (ctx.blockedTicks >= 3) {
      ctx.log(
        `move blocked ${ctx.blockedTicks} ticks at ` +
          `(${ctx.origin.x.toFixed(2)}, ${ctx.origin.y.toFixed(2)}, ${ctx.origin.z.toFixed(2)}) ` +
          `vel (${ctx.velocity.x.toFixed(1)}, ${ctx.velocity.y.toFixed(1)}, ${ctx.velocity.z.toFixed(1)}) ` +
          `contacts [${ctx.contactsThisTick.join(' ')}] — velocity zeroed`,
      );
      set(ctx.velocity, 0, 0, 0);
      ctx.blockedTicks = 0;
    }
  } else {
    ctx.blockedTicks = 0;
  }
}
