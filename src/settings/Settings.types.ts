/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { StaminaSettings } from '../physics/Stamina/Stamina.types.js';
import type { PerfSettings } from '../physics/PerfBonus/PerfBonus.types.js';

export type { StaminaSettings, PerfSettings };

export interface CrosshairSettings {
  color: string;
  size: number; // arm length, px
  thickness: number; // px
  gap: number; // px from center to arm start
  outline: boolean;
  dot: boolean;
  tStyle: boolean; // no top arm
}

export interface Settings {
  sensitivity: number;
  mYaw: number; // deg per mouse count, CS:GO's m_yaw/m_pitch
  fov: number; // horizontal FOV in CS:GO 4:3 terms
  tickRate: number;
  autobhop: boolean;
  /** sv_enablebunnyhopping 0 — clamp takeoff speed to 1.1 × maxspeed. */
  bhopSpeedClamp: boolean;
  /**
   * "nopre": air-strafe/prestrafe speed gain (see airAccelerate) is left
   * completely unrestricted — this does NOT cap AirMove. Instead it puts a
   * hard ceiling on GROUND speed at the player's current max speed: land
   * with more than that (from prestrafing, a bhop chain, a perf-bonus
   * takeoff, ...) and walkMove clamps it down the moment you're grounded and
   * moving under your own power. You can still build wild air speed for
   * style/tech; you just can't cash it in as a permanent ground sprint.
   */
  noPrestrafe: boolean;
  airAccelerate: number;
  runSpeed: number;
  walkSpeed: number;
  crouchSpeed: number;
  showSpeed: boolean;
  showFps: boolean;
  showDebug: boolean;
  viewPunch: boolean;
  crosshair: CrosshairSettings;
  stamina: StaminaSettings;
  perf: PerfSettings;
}
