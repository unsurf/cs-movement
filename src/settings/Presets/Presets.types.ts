/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { PerfSettings, PhysicsSettings, Settings, StaminaSettings } from '../Settings.types.js';
import type { PRESET_NAMES } from './Presets.config.js';

export type PresetName = (typeof PRESET_NAMES)[number];

/** The slice of Settings a preset owns. Mouse, FOV, crosshair and HUD settings are never touched. */
export type PresetSettings = Pick<Settings, 'autobhop' | 'bhopSpeedClamp' | 'noPrestrafe' | 'airAccelerate'> & {
  stamina: StaminaSettings;
  perf: PerfSettings;
  physics: PhysicsSettings;
};

export interface Preset {
  label: string;
  /** Where the numbers come from, and how much to trust them. */
  source: string;
  settings: PresetSettings;
}
