/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { StaminaSettings } from './Stamina.types.js';

/** STAMINA_RANGE: the scale stamina is divided by when it throttles jumps and speed. */
export const STAMINA_RANGE = 100;

export const DEFAULT_STAMINA_SETTINGS: StaminaSettings = {
  enabled: false,
  max: 80,
  jumpCost: 0.08,
  landCost: 0.05,
  recoveryRate: 60,
};
