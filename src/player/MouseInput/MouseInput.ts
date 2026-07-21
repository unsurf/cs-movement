/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { MovementContext } from '../MovementContext.js';

/**
 * Chromium's pointer lock occasionally emits a single bogus huge
 * movementX/Y (notably right after (re)acquiring the lock or on focus
 * glitches), which reads as the view "snapping". Filter: drop the first
 * event after a lock change, and drop isolated spikes that are both
 * large and far out of line with the previous event.
 *
 * Returns a mousemove handler plus the pointerlockchange hook it needs
 * wired up (both close over the same discard/last-sample state).
 */
export function createMouseInputHandlers(ctx: MovementContext): {
  onPointerLockChange: () => void;
  onMouseMove: (dx: number, dy: number) => void;
} {
  let discardNextMouse = true;
  let lastDx = 0;
  let lastDy = 0;

  return {
    onPointerLockChange(): void {
      discardNextMouse = true;
    },
    onMouseMove(dx: number, dy: number): void {
      if (discardNextMouse) {
        discardNextMouse = false;
        lastDx = dx;
        lastDy = dy;
        return;
      }
      const spikeX = Math.abs(dx) > 350 && Math.abs(dx) > 8 * Math.abs(lastDx) + 100;
      const spikeY = Math.abs(dy) > 350 && Math.abs(dy) > 8 * Math.abs(lastDy) + 100;
      if (spikeX || spikeY || Math.abs(dx) > 1200 || Math.abs(dy) > 1200) {
        ctx.log(`mouse snap filtered (dx ${dx}, dy ${dy})`);
        // Still update the baseline so a fast-but-legitimate turn only
        // loses this one frame, instead of every subsequent frame being
        // compared against a stale small lastDx/lastDy and re-triggering.
        lastDx = dx;
        lastDy = dy;
        return;
      }
      lastDx = dx;
      lastDy = dy;
      const sens = ctx.settings.sensitivity * ctx.settings.mYaw;
      ctx.yaw -= dx * sens;
      ctx.pitch -= dy * sens;
      ctx.pitch = Math.max(-89, Math.min(89, ctx.pitch));
    },
  };
}
