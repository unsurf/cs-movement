/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import type { InputState } from '../MovementContext.js';

/** Forward(+)/back(-) deflection in [-1, 1]: the analog axis if set, else the keys. */
export function forwardAxis(input: InputState): number {
  return input.forwardMove ?? (input.forward ? 1 : 0) - (input.back ? 1 : 0);
}

/** Right(+)/left(-) deflection in [-1, 1]: the analog axis if set, else the keys. */
export function sideAxis(input: InputState): number {
  return input.sideMove ?? (input.right ? 1 : 0) - (input.left ? 1 : 0);
}
