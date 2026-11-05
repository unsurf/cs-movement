/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Vec3, clone, copy } from '../../math/vec3.js';
import type { PlayerController } from '../PlayerController.js';
import type { PlayerState } from './PlayerState.types.js';

function restoreVec(out: Vec3, from: Vec3): void {
  copy(out, from);
}

/** Capture the full simulation state as plain data. */
export function snapshotPlayer(p: PlayerController): PlayerState {
  const ladderIndex = p.onLadder === null ? -1 : p.world.ladders.indexOf(p.onLadder);
  return {
    origin: clone(p.origin),
    velocity: clone(p.velocity),
    yaw: p.yaw,
    pitch: p.pitch,
    onGround: p.onGround,
    surfaceFriction: p.surfaceFriction,
    groundNormal: clone(p.groundNormal),
    ducked: p.ducked,
    ducking: p.ducking,
    duckFlag: p.duckFlag,
    duckHeld: p.duckHeld,
    duckFrac: p.duckFrac,
    duckSpeed: p.duckSpeed,
    rawDuckPrev: p.rawDuckPrev,
    lastDuckTime: Number.isFinite(p.lastDuckTime) ? p.lastDuckTime : null,
    fullDuckX: p.fullDuckX,
    fullDuckZ: p.fullDuckZ,
    time: p.time,
    ladderIndex: ladderIndex >= 0 ? ladderIndex : null,
    surfing: p.surfing,
    surfedSinceGrounded: p.surfedSinceGrounded,
    prevPos: clone(p.prevPos),
    currPos: clone(p.currPos),
    prevEye: p.prevEye,
    currEye: p.currEye,
    landPunch: p.landPunch,
    stamina: p.stamina,
    lastHopQuality: p.lastHopQuality,
    input: { ...p.input },
    weapon: p.weapon === null ? null : { ...p.weapon },
    velocityModifier: p.velocityModifier,
    canMove: p.canMove,
    oldJump: p.oldJump,
    ladderCooldown: p.ladderCooldown,
    ladderJumpAllowedAt: p.ladderJumpAllowedAt,
    fallVelocity: p.fallVelocity,
    groundTicksSinceLanding: p.groundTicksSinceLanding,
    hasJumpedBefore: p.hasJumpedBefore,
    landingVelocity: clone(p.landingVelocity),
    stuckTicks: p.stuckTicks,
    blockedTicks: p.blockedTicks,
    stepAccumulator: p.stepAccumulator,
  };
}

/** Put a snapshot back. The ladder is looked up in the player's current world. */
export function restorePlayer(p: PlayerController, s: PlayerState): void {
  restoreVec(p.origin, s.origin);
  restoreVec(p.velocity, s.velocity);
  p.yaw = s.yaw;
  p.pitch = s.pitch;
  p.onGround = s.onGround;
  p.surfaceFriction = s.surfaceFriction;
  restoreVec(p.groundNormal, s.groundNormal);
  p.ducked = s.ducked;
  p.ducking = s.ducking;
  p.duckFlag = s.duckFlag;
  p.duckHeld = s.duckHeld;
  p.duckFrac = s.duckFrac;
  p.duckSpeed = s.duckSpeed;
  p.rawDuckPrev = s.rawDuckPrev;
  p.lastDuckTime = s.lastDuckTime ?? Number.NEGATIVE_INFINITY;
  p.fullDuckX = s.fullDuckX;
  p.fullDuckZ = s.fullDuckZ;
  p.time = s.time;
  p.onLadder = s.ladderIndex === null ? null : (p.world.ladders[s.ladderIndex] ?? null);
  p.surfing = s.surfing;
  p.surfedSinceGrounded = s.surfedSinceGrounded;
  restoreVec(p.prevPos, s.prevPos);
  restoreVec(p.currPos, s.currPos);
  p.prevEye = s.prevEye;
  p.currEye = s.currEye;
  p.landPunch = s.landPunch;
  p.stamina = s.stamina;
  p.lastHopQuality = s.lastHopQuality;
  Object.assign(p.input, s.input);
  p.weapon = s.weapon === null ? null : { ...s.weapon };
  p.velocityModifier = s.velocityModifier;
  p.canMove = s.canMove;
  p.oldJump = s.oldJump;
  p.ladderCooldown = s.ladderCooldown;
  p.ladderJumpAllowedAt = s.ladderJumpAllowedAt;
  p.fallVelocity = s.fallVelocity;
  p.groundTicksSinceLanding = s.groundTicksSinceLanding;
  p.hasJumpedBefore = s.hasJumpedBefore;
  restoreVec(p.landingVelocity, s.landingVelocity);
  p.stuckTicks = s.stuckTicks;
  p.blockedTicks = s.blockedTicks;
  p.stepAccumulator = s.stepAccumulator;
}
