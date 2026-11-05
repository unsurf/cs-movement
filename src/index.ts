/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */

// Public surface. The simulation core (vec3, constants, physics/*, player/*,
// PlayerController.tick) is renderer-agnostic and runs headless in node. The
// only browser-dependent pieces are PlayerController.bindInput and
// loadSettings/saveSettings — call those from a DOM environment or not at all.

export * from './math/vec3.js';
export * from './constants.js';

export * from './physics/Friction/Friction.js';
export * from './physics/Friction/Friction.config.js';
export * from './physics/Accelerate/Accelerate.js';
export * from './physics/Accelerate/Accelerate.config.js';
export type { MovementEvent, MovementEventType } from './player/MovementEvents/MovementEvents.types.js';
export type { PlayerState } from './player/PlayerState/PlayerState.types.js';
export type { AdvanceResult, InterpolatedPose } from './player/FixedStep/FixedStep.types.js';
export type { WeaponState } from './player/WeaponState/WeaponState.types.js';
export { baseMaxSpeed } from './player/CurrentMaxSpeed/CurrentMaxSpeed.js';
export type { AccelerateModifiers } from './physics/Accelerate/Accelerate.types.js';
export * from './physics/AirAccelerate/AirAccelerate.js';
export * from './physics/AirAccelerate/AirAccelerate.config.js';
export * from './physics/ClipVelocity/ClipVelocity.js';
export * from './physics/ClipVelocity/ClipVelocity.config.js';
export * from './physics/Stamina/Stamina.js';
export * from './physics/PerfBonus/PerfBonus.js';
export * from './physics/PhysicsSettings/PhysicsSettings.config.js';
export type { PhysicsSettings } from './physics/PhysicsSettings/PhysicsSettings.types.js';
export * from './physics/Collision/Collision.js';
export * from './physics/Collision/Collision.config.js';
export * from './physics/World/World.js';

export * from './settings/Settings.js';
export * from './settings/Presets/Presets.js';

export * from './player/Jump/Jump.config.js';
export * from './player/Duck/Duck.config.js';
export * from './player/Ladder/Ladder.config.js';
export * from './player/StepMove/StepMove.config.js';
export * from './player/TryPlayerMove/TryPlayerMove.config.js';
export * from './player/CategorizePosition/CategorizePosition.config.js';
export * from './player/MouseInput/MouseInput.config.js';
export * from './player/PlayerController.js';
