/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { StaminaSettings } from './Stamina.types.js';

export const DEFAULT_STAMINA_SETTINGS: StaminaSettings = {
  enabled: false,
  max: 1,
  jumpCost: 0.08,
  landCost: 0.05,
  recoveryRate: 0.5,
  maxPenalty: 0.4,
};
