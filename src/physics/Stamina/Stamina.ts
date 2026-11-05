/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Provenance (cstrike15_src@f82112a, game/shared/cstrike15/cs_gamemovement.cpp):
// CCSGameMovement::OnJump / OnLand / ReduceTimers / CheckParameters / CheckJumpButton

import { STAMINA_RANGE } from './Stamina.config.js';

/**
 * Add stamina (a jump or a landing), clamped to the pool max.
 */
export function addStamina(current: number, amount: number, max: number): number {
  return Math.min(max, Math.max(0, current + amount));
}

/**
 * Drain stamina toward 0 at `recoveryRate` units per second.
 */
export function recoverStamina(current: number, recoveryRate: number, dt: number): number {
  return Math.max(0, current - recoveryRate * dt);
}

/** Jump-velocity multiplier: 1 - stamina/100, clamped to 0..1. */
export function staminaJumpMultiplier(stamina: number): number {
  return Math.min(1, Math.max(0, 1 - stamina / STAMINA_RANGE));
}

/**
 * Max-speed multiplier: the jump multiplier squared, so half-full stamina
 * costs a quarter of top speed (and quarter jump height) while the jump
 * itself only loses half its velocity.
 */
export function staminaSpeedMultiplier(stamina: number): number {
  const jump = staminaJumpMultiplier(stamina);
  return jump * jump;
}
