/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// The shape every extracted movement behavior (Jump, WalkMove, TryPlayerMove,
// ...) operates on. PlayerController implements this directly — its instance
// fields ARE the context fields, so passing `this` to a behavior function is
// free: no wrapper object, no proxying, no per-tick allocation. The scratch
// vectors (wishDir/moveEnd/tmpA/tmpB) are reused across ticks for the same
// reason the original monolithic class reused them.

import type { Vec3 } from '../math/vec3.js';
import type { LadderVolume, TraceResult } from '../physics/Collision/Collision.types.js';
import type { World } from '../physics/World/World.js';
import type { Settings } from '../settings/Settings.js';
import type { ContactLog } from './ContactLog/ContactLog.js';

/** Shared by every behavior that turns ctx.yaw/pitch (degrees) into a direction vector. */
export const DEG2RAD = Math.PI / 180;

export interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  duck: boolean;
  walk: boolean;
  reset: boolean;
}

export interface MovementContext {
  readonly world: World;
  readonly settings: Settings;
  /** Called on anomalies (unstuck pops, velocity kills). */
  readonly log: (msg: string) => void;

  origin: Vec3;
  velocity: Vec3;
  yaw: number; // degrees; 0 looks down -Z
  pitch: number;

  onGround: boolean;
  /** player->m_surfaceFriction: scales air acceleration; 0.25 while rising without ground (see CategorizePosition). */
  surfaceFriction: number;
  groundNormal: Vec3;
  ducked: boolean; // m_bDucked: fully ducked, hull is the ducked hull
  ducking: boolean; // m_bDucking: duck/unduck transition in progress
  duckFlag: boolean; // FL_DUCKING: set when fully ducked, cleared early in the unduck
  duckHeld: boolean; // IN_DUCK after the anti-spam filter
  duckFrac: number; // m_flDuckAmount: 0 standing, 1 ducked
  duckSpeed: number; // m_flDuckSpeed: spam-penalised duck rate
  rawDuckPrev: boolean; // last tick's raw duck key (spam penalty edge detect)
  lastDuckTime: number; // m_flLastDuckTime: ctx.time when a duck last finished
  fullDuckX: number; // m_vecLastPositionAtFullCrouchSpeed
  fullDuckZ: number;
  /** Simulated seconds since spawn (gpGlobals->curtime). */
  time: number;
  onLadder: LadderVolume | null;
  /** True while standing on a surf-steep slope (airborne rules, no friction). */
  surfing: boolean;
  /** True from the moment surfing starts until the next real ground landing. */
  surfedSinceGrounded: boolean;

  /** Position snapshot from the start of this tick, for blocked-move detection. */
  prevPos: Vec3;
  prevEye: number;
  currEye: number;
  landPunch: number; // downward view offset from landing, decays each tick

  /** 0..settings.stamina.max; only meaningful while settings.stamina.enabled. */
  stamina: number;
  /** Quality of the most recent takeoff; only set while settings.perf.enabled. */
  lastHopQuality: 'perfect' | 'normal' | null;

  readonly input: InputState;

  oldJump: boolean; // was +jump held last tick (Source's pogo-stick check)
  ladderCooldown: number; // seconds before ladder can re-grip after jump-off
  fallVelocity: number;
  groundTicksSinceLanding: number; // ground-friction ticks elapsed since landing
  /** True once a real jump (via checkJump) has ever launched this life — gates the perfect-bhop carry. */
  hasJumpedBefore: boolean;
  /** Horizontal velocity snapshotted the instant of the last landing; see PerfBonus. */
  landingVelocity: Vec3;
  stuckTicks: number;
  blockedTicks: number;
  contactsThisTick: ContactLog;

  // Scratch vectors — reused across ticks to avoid allocation.
  readonly wishDir: Vec3;
  readonly moveEnd: Vec3;
  readonly tmpA: Vec3;
  readonly tmpB: Vec3;
  /** Reusable trace output; only valid until the next trace made with it. */
  readonly traceResult: TraceResult;

  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly horizontalSpeed: number;
}
