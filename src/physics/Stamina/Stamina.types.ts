/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */

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
