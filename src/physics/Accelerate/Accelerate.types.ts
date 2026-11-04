/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * CCSGameMovement::Accelerate's movement-state modifiers.
 */
export interface AccelerateModifiers {
  /** Duck (crouchSpeed / runSpeed) or walk (walkSpeed / runSpeed) multiplier on the acceleration scale; 1 otherwise. */
  speedFactor: number;
  /** Walk key held and not ducking: acceleration fades out just below the walk goal speed. */
  walking: boolean;
}
