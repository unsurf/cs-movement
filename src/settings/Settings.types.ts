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
   * "nopre": stops angled strafing — on the ground or in the air — from
   * adding speed beyond the player's current ground max speed. Both
   * accelerate() and airAccelerate() compare addspeed against
   * dot(velocity, wishdir) rather than |velocity|, so continuously turning
   * wishdir while strafing can gain speed past maxspeed either way; this
   * caps both. It only blocks NEW gains from that turning-strafe accel —
   * speed the player already has (a bhop chain with bhopSpeedClamp off, a
   * perf-bonus takeoff, ...) is left alone, so this composes with those
   * instead of silently overriding them — and it never applies while
   * surfing, which legitimately depends on exceeding ground max speed.
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
