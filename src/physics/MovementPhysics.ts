/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 Liam Grant
 * SPDX-License-Identifier: Apache-2.0
 */
// Pure Source-engine movement formulas. Each function mutates `vel` in place
// and has no other side effects, so they are directly unit-testable.
//
// Provenance (Valve source-sdk-2013, game/shared/gamemovement.cpp):
//   applyFriction  -> CGameMovement::Friction
//   accelerate     -> CGameMovement::Accelerate
//   airAccelerate  -> CGameMovement::AirAccelerate
//   clipVelocity   -> CGameMovement::ClipVelocity

import { AIR_SPEED_CAP } from '../constants';
import type { Vec3 } from '../math/vec3';

/**
 * Ground friction. Only horizontal components bleed speed (y is vertical and
 * is zeroed while grounded anyway).
 */
export function applyFriction(vel: Vec3, friction: number, stopspeed: number, dt: number): void {
  const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
  if (speed < 0.1) return;

  const control = speed < stopspeed ? stopspeed : speed;
  const drop = control * friction * dt;

  let newspeed = speed - drop;
  if (newspeed < 0) newspeed = 0;

  if (newspeed !== speed) {
    const ratio = newspeed / speed;
    vel.x *= ratio;
    vel.z *= ratio;
  }
}

/**
 * Ground acceleration. The `addspeed = wishspeed - dot(vel, wishdir)` term is
 * what caps ground speed at maxspeed: once you're moving at wishspeed in the
 * wish direction no more speed is added.
 */
export function accelerate(vel: Vec3, wishdir: Vec3, wishspeed: number, accel: number, dt: number): void {
  const currentspeed = vel.x * wishdir.x + vel.y * wishdir.y + vel.z * wishdir.z;
  const addspeed = wishspeed - currentspeed;
  if (addspeed <= 0) return;

  let accelspeed = accel * dt * wishspeed;
  if (accelspeed > addspeed) accelspeed = addspeed;

  vel.x += accelspeed * wishdir.x;
  vel.y += accelspeed * wishdir.y;
  vel.z += accelspeed * wishdir.z;
}

/**
 * Air acceleration — the bhop/surf formula. Note the deliberate asymmetry:
 * `addspeed` uses the 30 u/s capped wishspeed, but `accelspeed` uses the
 * UNCAPPED wishspeed. That is exactly what Source does, and it's why large
 * sv_airaccelerate values give near-instant air control. There is no cap on
 * the resulting velocity, which is what lets strafing exceed maxspeed.
 */
export function airAccelerate(
  vel: Vec3,
  wishdir: Vec3,
  wishspeed: number,
  airaccel: number,
  dt: number,
  airCap: number = AIR_SPEED_CAP,
): void {
  const wishspd = wishspeed > airCap ? airCap : wishspeed;

  const currentspeed = vel.x * wishdir.x + vel.y * wishdir.y + vel.z * wishdir.z;
  const addspeed = wishspd - currentspeed;
  if (addspeed <= 0) return;

  let accelspeed = airaccel * wishspeed * dt;
  if (accelspeed > addspeed) accelspeed = addspeed;

  vel.x += accelspeed * wishdir.x;
  vel.y += accelspeed * wishdir.y;
  vel.z += accelspeed * wishdir.z;
}

/**
 * Slide velocity along a plane. overbounce 1.0 (surf) removes exactly the
 * into-plane component; 1.001 (ordinary clipping) removes a hair more so the
 * player doesn't re-penetrate the plane next tick.
 */
export function clipVelocity(vel: Vec3, normal: Vec3, overbounce: number): void {
  const backoff = (vel.x * normal.x + vel.y * normal.y + vel.z * normal.z) * overbounce;
  vel.x -= normal.x * backoff;
  vel.y -= normal.y * backoff;
  vel.z -= normal.z * backoff;

  // CS:GO's extra adjust step (added to Source for surf ramps): float error
  // can leave a residual into-plane component at overbounce 1.0, which makes
  // the mover re-collide with the same plane every tick and eventually stick.
  const adjust = vel.x * normal.x + vel.y * normal.y + vel.z * normal.z;
  if (adjust < 0) {
    vel.x -= normal.x * adjust;
    vel.y -= normal.y * adjust;
    vel.z -= normal.z * adjust;
  }
}
