/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { DEFAULT_SETTINGS } from './Settings.config.js';
import type { Settings } from './Settings.types.js';

export type { CrosshairSettings, StaminaSettings, Settings } from './Settings.types.js';
export { DEFAULT_SETTINGS } from './Settings.config.js';

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
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
