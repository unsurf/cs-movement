/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Vec3 } from '../../math/vec3.js';
import type { InputState } from '../MovementContext.js';
import type { WeaponState } from '../WeaponState/WeaponState.types.js';

/**
 * Everything the simulation carries between ticks, as plain JSON-safe data
 * (no infinities, no object references). restore(snapshot()) followed by N
 * ticks is identical to N uninterrupted ticks.
 */
export interface PlayerState {
  origin: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  onGround: boolean;
  surfaceFriction: number;
  groundNormal: Vec3;
  ducked: boolean;
  ducking: boolean;
  duckFlag: boolean;
  duckHeld: boolean;
  duckFrac: number;
  duckSpeed: number;
  rawDuckPrev: boolean;
  /** null = never ducked (m_flLastDuckTime = -infinity). */
  lastDuckTime: number | null;
  fullDuckX: number;
  fullDuckZ: number;
  time: number;
  /** Index into world.ladders, or null. */
  ladderIndex: number | null;
  surfing: boolean;
  surfedSinceGrounded: boolean;
  prevPos: Vec3;
  currPos: Vec3;
  prevEye: number;
  currEye: number;
  landPunch: number;
  stamina: number;
  lastHopQuality: 'perfect' | 'normal' | null;
  input: InputState;
  weapon: WeaponState | null;
  velocityModifier: number;
  canMove: boolean;
  oldJump: boolean;
  ladderCooldown: number;
  ladderJumpAllowedAt: number;
  fallVelocity: number;
  groundTicksSinceLanding: number;
  hasJumpedBefore: boolean;
  landingVelocity: Vec3;
  stuckTicks: number;
  blockedTicks: number;
  stepAccumulator: number;
}
