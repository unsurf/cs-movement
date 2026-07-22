/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { CROUCH_SPEED, DEFAULT_TICK_RATE, RUN_SPEED, WALK_SPEED } from '../constants.js';
import { M_YAW } from '../player/MouseInput/MouseInput.config.js';
import { AIR_ACCELERATE } from '../physics/AirAccelerate/AirAccelerate.config.js';
import { DEFAULT_STAMINA_SETTINGS } from '../physics/Stamina/Stamina.config.js';
import { DEFAULT_PERF_SETTINGS } from '../physics/PerfBonus/PerfBonus.config.js';
import type { Settings } from './Settings.types.js';

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 1.5,
  mYaw: M_YAW,
  fov: 90,
  tickRate: DEFAULT_TICK_RATE,
  autobhop: true,
  bhopSpeedClamp: true,
  noPrestrafe: true,
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
  stamina: { ...DEFAULT_STAMINA_SETTINGS },
  perf: { ...DEFAULT_PERF_SETTINGS },
};
