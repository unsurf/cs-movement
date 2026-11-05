/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { Settings } from '../Settings.types.js';
import { PRESETS } from './Presets.config.js';
import type { PresetName } from './Presets.types.js';

export { PRESETS, PRESET_NAMES } from './Presets.config.js';
export type { Preset, PresetName, PresetSettings } from './Presets.types.js';

/**
 * Returns a copy of `base` with a preset's movement settings applied. Input,
 * display and crosshair settings carry over from `base` unchanged; `base` is
 * not mutated.
 */
export function applyPreset(base: Settings, name: PresetName): Settings {
  const preset = structuredClone(PRESETS[name].settings);
  return { ...structuredClone(base), ...preset };
}
