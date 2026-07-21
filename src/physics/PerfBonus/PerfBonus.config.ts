/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { PerfSettings } from './PerfBonus.types.js';

export const DEFAULT_PERF_SETTINGS: PerfSettings = {
  enabled: false,
  greyWindowTicks: 4,
  bonusFactor: 0.05,
  autobhopChance: 0.42,
};
