/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// TryPlayerMove always clips with overbounce 1: sv_bounce is 0 in CS:GO, so
// even the airborne first-impact formula 1 + sv_bounce * (1 - friction) is 1.
export const OVERBOUNCE = 1.0;
