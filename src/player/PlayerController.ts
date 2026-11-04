/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Per-tick player simulation following Source's CGameMovement pipeline
// (cstrike15_src@f82112a): duck -> ladder -> StartGravity -> CheckJumpButton
// -> Friction/Accelerate (ground) or AirAccelerate (air/surf) + TryPlayerMove
// -> CategorizePosition -> FinishGravity. All state is in Source units, Y-up.
//
// This class IS a MovementContext (see MovementContext.ts) — its fields are
// passed by reference to each extracted behavior (Jump, WalkMove, ...), so
// tick() is a thin, ordered sequence of calls with no extra allocation.

import { type Vec3, clone, copy, length2D, set, vec3 } from '../math/vec3.js';
import { recoverStamina } from '../physics/Stamina/Stamina.js';
import { createTraceResult } from '../physics/Collision/Collision.js';
import type { LadderVolume, TraceResult } from '../physics/Collision/Collision.types.js';
import type { World } from '../physics/World/World.js';
import type { Settings } from '../settings/Settings.js';

import { type InputState, type MovementContext } from './MovementContext.js';
import { DUCK_MAXS, DUCK_MINS, STAND_MAXS, STAND_MINS, updateDuck } from './Duck/Duck.js';
import { DUCK_SPEED_IDEAL, EYE_DUCK, EYE_STAND } from './Duck/Duck.config.js';
import { checkLadder, ladderMove } from './Ladder/Ladder.js';
import { checkJump } from './Jump/Jump.js';
import { checkVelocity } from './CheckVelocity/CheckVelocity.js';
import { finishGravity, startGravity } from './Gravity/Gravity.js';
import { walkMove } from './WalkMove/WalkMove.js';
import { airMove } from './AirMove/AirMove.js';
import { categorizePosition } from './CategorizePosition/CategorizePosition.js';
import { checkStuck } from './StuckCheck/StuckCheck.js';
import { detectBlockedMove } from './BlockedMove/BlockedMove.js';
import { createMouseInputHandlers } from './MouseInput/MouseInput.js';
import { ContactLog } from './ContactLog/ContactLog.js';
import { TickHistory } from './TickHistory/TickHistory.js';

/** Optional host hooks. Movement never logs or touches globals on its own. */
export interface PlayerOptions {
  /** Called on anomalies (unstuck pops, velocity kills). Default: no-op. */
  log?: (msg: string) => void;
}

export class PlayerController implements MovementContext {
  readonly world: World;
  readonly settings: Settings;
  readonly log: (msg: string) => void;

  origin: Vec3;
  velocity = vec3();
  yaw = 0; // degrees; 0 looks down -Z
  pitch = 0;

  onGround = false;
  surfaceFriction = 1;
  groundNormal = vec3(0, 1, 0);
  ducked = false;
  ducking = false;
  duckFlag = false;
  duckHeld = false;
  duckFrac = 0; // m_flDuckAmount: 0 standing, 1 ducked (drives eye height)
  duckSpeed = DUCK_SPEED_IDEAL;
  rawDuckPrev = false;
  lastDuckTime = Number.NEGATIVE_INFINITY;
  fullDuckX = 0;
  fullDuckZ = 0;
  time = 0;
  onLadder: LadderVolume | null = null;

  /** True while standing on a surf-steep slope (airborne rules, no friction). */
  surfing = false;
  /** True from the moment surfing starts until the next real ground landing. */
  surfedSinceGrounded = false;

  // Interpolation snapshots (position + eye height per tick).
  prevPos: Vec3;
  currPos: Vec3;
  prevEye = EYE_STAND;
  currEye = EYE_STAND;

  landPunch = 0; // downward view offset from landing, decays each tick

  /** 0..settings.stamina.max; only meaningful while settings.stamina.enabled. */
  stamina = 0;
  /** Quality of the most recent takeoff; only set while settings.perf.enabled. */
  lastHopQuality: 'perfect' | 'normal' | null = null;

  readonly input: InputState = {
    forward: false,
    back: false,
    left: false,
    right: false,
    jump: false,
    duck: false,
    walk: false,
    reset: false,
  };

  oldJump = false; // was +jump held last tick (Source's pogo-stick check)
  // Space is a real held key — input.jump should track it continuously.
  // mwheelup/mwheeldown has no keyup of its own and, per Source's own
  // command-frame batching, each notch is meant to register as exactly one
  // tick's worth of "+jump" rather than a timed hold — see bindInput()'s
  // wheel handler and tick()'s consumption of wheelJumpQueued below.
  private keyJumpHeld = false;
  private wheelJumpQueued = false;
  // Only true once bindInput() has wired up real listeners — tick() must
  // never touch input.jump on its own otherwise, since tests throughout this
  // codebase drive it directly (player.input.jump = true) without binding.
  private inputBound = false;
  ladderCooldown = 0; // seconds before ladder can re-grip after jump-off
  fallVelocity = 0;
  groundTicksSinceLanding = 0; // ground-friction ticks elapsed since landing
  // Gravity settling you onto the ground you spawned on isn't a jump landing
  // — this only flips true the moment checkJump actually launches a real
  // jump, so the perfect-bhop carry can never fire on a jump with no
  // previous jump to chain from (see Jump.ts).
  hasJumpedBefore = false;
  /** Horizontal velocity snapshotted the instant of the last landing; see PerfBonus. */
  landingVelocity = vec3();
  stuckTicks = 0;
  blockedTicks = 0;
  contactsThisTick = new ContactLog();

  // Scratch vectors — reused across ticks to avoid allocation.
  readonly wishDir = vec3();
  readonly moveEnd = vec3();
  readonly tmpA = vec3();
  readonly tmpB = vec3();
  readonly traceResult: TraceResult = createTraceResult();

  // Rolling per-tick history for dumpMovementLog(). Not part of
  // MovementContext — this is PlayerController's own diagnostic API.
  private readonly tickHistory = new TickHistory();
  private readonly spawn: Vec3;

  constructor(world: World, settings: Settings, spawn: Vec3, opts: PlayerOptions = {}) {
    this.world = world;
    this.settings = settings;
    this.log = opts.log ?? (() => {});
    this.spawn = clone(spawn);
    this.origin = clone(spawn);
    this.prevPos = clone(spawn);
    this.currPos = clone(spawn);
  }

  /**
   * Rolling record of every simulated tick (position, velocity, inputs,
   * contact planes), oldest first. Pull it when you want a movement dump —
   * the library never registers globals to push it anywhere.
   */
  tickHistoryText(): string {
    return this.tickHistory.toString();
  }

  get mins(): Vec3 {
    return this.ducked ? DUCK_MINS : STAND_MINS;
  }

  get maxs(): Vec3 {
    return this.ducked ? DUCK_MAXS : STAND_MAXS;
  }

  get eyeHeight(): number {
    // SetDuckedEyeOffset eases the view height with SimpleSpline.
    const t = this.duckFrac;
    return EYE_STAND + (EYE_DUCK - EYE_STAND) * (3 * t * t - 2 * t * t * t);
  }

  get horizontalSpeed(): number {
    return length2D(this.velocity);
  }

  // -- Input ----------------------------------------------------------------

  bindInput(target: HTMLElement): void {
    this.inputBound = true;
    const keyMap: Record<string, keyof InputState | undefined> = {
      KeyW: 'forward',
      KeyS: 'back',
      KeyA: 'left',
      KeyD: 'right',
      ShiftLeft: 'walk',
      ControlLeft: 'duck',
      KeyC: 'duck',
      KeyR: 'reset',
    };
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.keyJumpHeld = true;
        e.preventDefault();
        return;
      }
      const action = keyMap[e.code];
      if (action) {
        this.input[action] = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.keyJumpHeld = false;
        return;
      }
      const action = keyMap[e.code];
      if (action) this.input[action] = false;
    });

    // bind "mwheelup" "+jump" / "mwheeldown" "+jump": the standard chasemod
    // bind, alongside space rather than instead of it. Scrolling the wheel
    // through one physical motion (bottom notch to top notch) doesn't fire
    // one 'wheel' event — it fires a rapid burst of a dozen-plus, each one a
    // genuine, independent +jump/-jump pair. That's the whole mechanism
    // behind chasemod wheel-bhop: spamming +jump repeatedly gives many
    // independent chances for one press to land on the exact tick after a
    // landing and catch a perfect rejump.
    //
    // A wall-clock timed pulse (tried here previously, twice) can't get this
    // right: too long a pulse and consecutive notches merge into one
    // continuous "held" state — which, exactly like holding spacebar down
    // through a landing, fails the pogo-stick re-press check for real, not
    // just in this sim; too short and a pulse can lapse between physics
    // ticks depending on frame timing, silently eating the notch. Neither
    // duration is really "correct" because milliseconds are the wrong unit
    // — what actually matters is *ticks*, since that's what checkJump reads.
    // So: a wheel event just queues a request; tick() consumes it as
    // exactly one tick's worth of "+jump" and clears it immediately after,
    // regardless of how much wall-clock time that request sat queued.
    // Multiple events queued between two ticks (a whole burst arriving
    // within one rendered frame) collapse into that same single tick's
    // press — which matches Source's own per-command-frame batching, not a
    // bug — while a fresh event arriving after the previous one was
    // consumed re-arms a genuinely new press, so a spam spread across many
    // ticks gets many independent chances, never one merged hold.
    window.addEventListener(
      'wheel',
      (e) => {
        if (document.pointerLockElement !== target || e.deltaY === 0) return;
        e.preventDefault();
        this.wheelJumpQueued = true;
      },
      { passive: false },
    );

    const { onPointerLockChange, onMouseMove } = createMouseInputHandlers(this);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== target) return;
      onMouseMove(e.movementX, e.movementY);
    });
  }

  respawn(): void {
    copy(this.origin, this.spawn);
    set(this.velocity, 0, 0, 0);
    copy(this.prevPos, this.spawn);
    copy(this.currPos, this.spawn);
    this.onGround = false;
    this.surfaceFriction = 1;
    this.onLadder = null;
    this.ducked = false;
    this.ducking = false;
    this.duckFlag = false;
    this.duckHeld = false;
    this.duckFrac = 0;
    this.duckSpeed = DUCK_SPEED_IDEAL;
    this.rawDuckPrev = false;
    this.lastDuckTime = Number.NEGATIVE_INFINITY;
    this.stamina = 0;
    this.groundTicksSinceLanding = 0;
    this.hasJumpedBefore = false;
    this.surfedSinceGrounded = false;
    set(this.landingVelocity, 0, 0, 0);
    this.lastHopQuality = null;
  }

  // -- Simulation -----------------------------------------------------------

  tick(dt: number): void {
    copy(this.prevPos, this.currPos);
    this.prevEye = this.currEye;

    // Space stays pressed for as long as it's physically held; a queued
    // wheel notch is consumed for exactly this one tick and then gone,
    // whether or not Space is also down — see bindInput()'s wheel handler.
    if (this.inputBound) {
      this.input.jump = this.keyJumpHeld || this.wheelJumpQueued;
      this.wheelJumpQueued = false;
    }

    if (this.input.reset) {
      this.input.reset = false;
      this.respawn();
    }

    if (this.ladderCooldown > 0) this.ladderCooldown -= dt;
    this.time += dt;
    updateDuck(this, dt);
    if (this.settings.stamina.enabled) {
      this.stamina = recoverStamina(this.stamina, this.settings.stamina.recoveryRate, this.settings.stamina.max, dt);
    }

    if (!checkStuck(this)) {
      const ladder = checkLadder(this);
      if (ladder) {
        ladderMove(this, dt, ladder);
      } else {
        this.onLadder = null;
        // FullWalkMove order: fall speed is sampled before any gravity, then
        // half gravity, jump, ground friction/walk or air move, categorize,
        // the other half gravity, and finally ground zeroes vertical speed.
        if (!this.onGround) this.fallVelocity = -this.velocity.y;
        startGravity(this, dt);
        checkJump(this, dt);
        if (this.onGround) {
          this.velocity.y = 0;
          this.fallVelocity = 0;
        }
        checkVelocity(this.velocity);
        if (this.onGround) {
          walkMove(this, dt);
          this.groundTicksSinceLanding++;
        } else {
          airMove(this, dt);
        }
        categorizePosition(this);
        checkVelocity(this.velocity);
        finishGravity(this, dt);
        if (this.onGround) this.velocity.y = 0;
      }
    }

    detectBlockedMove(this);

    // Landing view punch (render-only, optional).
    this.landPunch *= Math.max(0, 1 - 10 * dt);
    this.oldJump = this.input.jump;
    this.recordTick();

    copy(this.currPos, this.origin);
    this.currEye = this.eyeHeight;
  }

  private recordTick(): void {
    this.tickHistory.record(this);
    this.contactsThisTick.clear();
  }
}
