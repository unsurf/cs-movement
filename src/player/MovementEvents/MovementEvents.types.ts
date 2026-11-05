/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Vec3 } from '../../math/vec3.js';

/** Things the host usually wants to react to (jumpstats, sounds, HUD) without diffing state. */
export type MovementEvent =
  | {
      type: 'jump';
      time: number;
      /** Horizontal speed at takeoff, after the bhop clamp / perfect carry. */
      speed: number;
      /** Only set while settings.perf.enabled. */
      quality: 'perfect' | 'normal' | null;
    }
  | {
      type: 'land';
      time: number;
      /** Downward speed the player was falling at when they touched ground. */
      fallSpeed: number;
      /** Horizontal speed at the moment of landing. */
      speed: number;
    }
  | { type: 'ladderEnter'; time: number }
  | { type: 'ladderExit'; time: number }
  | { type: 'duck'; time: number }
  | { type: 'unduck'; time: number }
  | { type: 'teleport'; time: number; origin: Vec3 };

export type MovementEventType = MovementEvent['type'];
