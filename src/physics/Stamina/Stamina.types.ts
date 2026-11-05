/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CS:GO's stamina (CCSGameMovement, cstrike15_src@f82112a). `stamina` is a
 * fatigue pool in 0..max units; every real jump adds `jumpCost` per u/s of
 * vertical impulse, every landing adds `landCost` per u/s of fall speed, and
 * it drains at `recoveryRate` units per second. While it is above zero:
 *
 *  - jump velocity is multiplied by (1 - stamina / 100)
 *  - max speed is multiplied by (1 - stamina / 100)^2
 *
 * (the 100 is Valve's STAMINA_RANGE, not `max`, which only caps the pool).
 * The cvar names are sv_staminajumpcost / sv_staminalandcost /
 * sv_staminarecoveryrate / sv_staminamax. Disabled by default.
 */
export interface StaminaSettings {
  enabled: boolean;
  max: number; // sv_staminamax: pool cap, 0..100
  jumpCost: number; // sv_staminajumpcost: stamina added per u/s of jump impulse
  landCost: number; // sv_staminalandcost: stamina added per u/s of fall speed on landing
  recoveryRate: number; // sv_staminarecoveryrate: stamina drained per second
}
