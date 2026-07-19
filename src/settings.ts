/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { AIR_ACCELERATE, CROUCH_SPEED, DEFAULT_TICK_RATE, M_YAW, RUN_SPEED, WALK_SPEED } from './constants';

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
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
