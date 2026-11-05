/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { GRAVITY } from '../../constants.js';
import { ACCELERATE } from '../Accelerate/Accelerate.config.js';
import { AIR_SPEED_CAP } from '../AirAccelerate/AirAccelerate.config.js';
import { FRICTION, STOP_SPEED } from '../Friction/Friction.config.js';
import { LADDER_SCALE_SPEED } from '../../player/Ladder/Ladder.config.js';
import { MAX_VELOCITY } from '../../player/CheckVelocity/CheckVelocity.config.js';
import { TIME_BETWEEN_DUCKS } from '../../player/Duck/Duck.config.js';
import type { PhysicsSettings } from './PhysicsSettings.types.js';

/** Stock CS:GO (movevars_shared.cpp / cs_gamemovement.cpp, cstrike15_src@f82112a). */
export const DEFAULT_PHYSICS_SETTINGS: PhysicsSettings = {
  accelerate: ACCELERATE,
  friction: FRICTION,
  stopSpeed: STOP_SPEED,
  gravity: GRAVITY,
  maxVelocity: MAX_VELOCITY,
  airSpeedCap: AIR_SPEED_CAP,
  ladderScaleSpeed: LADDER_SCALE_SPEED,
  timeBetweenDucks: TIME_BETWEEN_DUCKS,
};
