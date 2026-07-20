/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 Liam Grant
 * SPDX-License-Identifier: Apache-2.0
 */
import { AIR_ACCELERATE, CROUCH_SPEED, DEFAULT_TICK_RATE, M_YAW, RUN_SPEED, WALK_SPEED } from './constants.js';

export interface CrosshairSettings {
  color: string;
  size: number; // arm length, px
  thickness: number; // px
  gap: number; // px from center to arm start
  outline: boolean;
  dot: boolean;
  tStyle: boolean; // no top arm
}

/**
 * CS2-style stamina pool: jumping and landing add fractions of `max`; it
 * recovers over time; while full-ish, both max ground speed and jump
 * velocity are throttled. Valve hasn't published the exact formula this is
 * based on (sv_staminajumpcost / sv_staminalandcost / sv_staminamax), so
 * these are a tunable approximation, not verified game-accurate values.
 * Disabled by default — every existing preset (including "perf" bhop
 * modes) plays with this off, matching servers that zero the costs out.
 */
export interface StaminaSettings {
  enabled: boolean;
  max: number;
  jumpCost: number; // fraction of max added per jump
  landCost: number; // fraction of max added per landing
  recoveryRate: number; // fraction of max recovered per second
  maxPenalty: number; // fraction (0..1): speed/jump-velocity cut at a full pool
}

/**
 * Manual-timing bhop bonus: a takeoff within `greyWindowTicks` of the
 * earliest possible rejump (the tick right after landing) gets an extra
 * takeoff-speed multiplier that falls off linearly from `bonusFactor` at 0
 * ticks late to 0 at the window edge. This rewards manual timing on top of
 * the vanilla effect (skipping a tick of ground friction), it doesn't
 * replace it.
 *
 * autobhop trivializes that timing — held jump always re-fires on the
 * earliest possible tick, so the tick-based system above would classify
 * every single hop as a guaranteed 'perfect'. `autobhopChance` swaps in a
 * per-jump coin flip instead while autobhop is on, so the bonus stays a
 * bonus rather than a permanent buff.
 */
export interface PerfSettings {
  enabled: boolean;
  greyWindowTicks: number;
  bonusFactor: number;
  autobhopChance: number; // 0..1, chance of 'perfect' per autobhop jump
}

export interface Settings {
  sensitivity: number;
  mYaw: number; // deg per mouse count, CS:GO's m_yaw/m_pitch
  fov: number; // horizontal FOV in CS:GO 4:3 terms
  tickRate: number;
  autobhop: boolean;
  /** sv_enablebunnyhopping 0 — clamp takeoff speed to 1.1 × maxspeed (nopre). */
  bhopSpeedClamp: boolean;
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

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1.5,
  mYaw: M_YAW,
  fov: 90,
  tickRate: DEFAULT_TICK_RATE,
  autobhop: true,
  bhopSpeedClamp: true,
  airAccelerate: AIR_ACCELERATE,
  runSpeed: RUN_SPEED,
  walkSpeed: WALK_SPEED,
  crouchSpeed: CROUCH_SPEED,
  showSpeed: true,
  showFps: true,
  showDebug: true,
  viewPunch: false,
  crosshair: {
    color: '#00ff00',
    size: 6,
    thickness: 2,
    gap: 4,
    outline: true,
    dot: false,
    tStyle: false,
  },
  stamina: {
    enabled: false,
    max: 1,
    jumpCost: 0.08,
    landCost: 0.05,
    recoveryRate: 0.5,
    maxPenalty: 0.4,
  },
  perf: {
    enabled: false,
    greyWindowTicks: 4,
    bonusFactor: 0.05,
    autobhopChance: 0.42,
  },
};

// v2: defaults moved to nopre-KZ tuning (airaccelerate 100, takeoff clamp).
const STORAGE_KEY = 'hns-movement-sandbox.settings.v2';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_SETTINGS),
      ...parsed,
      crosshair: { ...DEFAULT_SETTINGS.crosshair, ...(parsed.crosshair ?? {}) },
      stamina: { ...DEFAULT_SETTINGS.stamina, ...(parsed.stamina ?? {}) },
      perf: { ...DEFAULT_SETTINGS.perf, ...(parsed.perf ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
