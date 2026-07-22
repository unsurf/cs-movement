/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { PerfSettings } from './PerfBonus.types.js';

export const DEFAULT_PERF_SETTINGS: PerfSettings = {
  enabled: false,
  maxBhopFrames: 12, // sm_realbhop default, ~93.75ms at 128 tick
  framePenalty: 0.975, // sm_realbhop default, ~2.5% carry lost per frame late
};
