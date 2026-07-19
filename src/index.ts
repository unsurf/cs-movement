/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 Liam Grant
 * SPDX-License-Identifier: Apache-2.0
 */

// Public surface. The simulation core (vec3, constants, MovementPhysics,
// Collision, PlayerController.tick) is renderer-agnostic and runs headless in
// node. The only browser-dependent pieces are PlayerController.bindInput and
// loadSettings/saveSettings — call those from a DOM environment or not at all.

export * from './math/vec3';
export * from './constants';
export * from './physics/MovementPhysics';
export * from './physics/Collision';
export * from './settings';
export * from './player/PlayerController';
