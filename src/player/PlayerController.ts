/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
// Per-tick player simulation following Source's CGameMovement pipeline:
// duck -> ladder -> CheckJumpButton -> Friction/Accelerate (ground) or
// AirAccelerate (air/surf) -> gravity halves around TryPlayerMove ->
// CategorizePosition. All state is in Source units, Y-up.
//
// This class IS a MovementContext (see MovementContext.ts) — its fields are
// passed by reference to each extracted behavior (Jump, WalkMove, ...), so
// tick() is a thin, ordered sequence of calls with no extra allocation.

import { type Vec3, clone, copy, length2D, set, vec3 } from '../math/vec3.js';
import { recoverStamina } from '../physics/Stamina/Stamina.js';
import type { LadderVolume } from '../physics/Collision/Collision.types.js';
import type { World } from '../physics/World/World.js';
import type { Settings } from '../settings/Settings.js';

import { type InputState, type MovementContext } from './MovementContext.js';
import { DUCK_MAXS, DUCK_MINS, STAND_MAXS, STAND_MINS, updateDuck } from './Duck/Duck.js';
import { DUCK_LERP_TIME, EYE_DUCK, EYE_STAND } from './Duck/Duck.config.js';
import { checkLadder, ladderMove } from './Ladder/Ladder.js';
import { checkJump } from './Jump/Jump.js';
import { walkMove } from './WalkMove/WalkMove.js';
import { airMove } from './AirMove/AirMove.js';
import { categorizePosition } from './CategorizePosition/CategorizePosition.js';
import { checkStuck } from './StuckCheck/StuckCheck.js';
import { detectBlockedMove } from './BlockedMove/BlockedMove.js';
import { createMouseInputHandlers } from './MouseInput/MouseInput.js';

/** Optional host hooks. Movement never logs or touches globals on its own. */
export interface PlayerOptions {
  /** Called on anomalies (unstuck pops, velocity kills). Default: no-op. */
  log?: (msg: string) => void;
  /** Source for the autobhop perf-chance roll. Default: Math.random. Inject for deterministic tests. */
  rng?: () => number;
}

export class PlayerController implements MovementContext {
  readonly world: World;
  readonly settings: Settings;
  readonly log: (msg: string) => void;
  readonly rng: () => number;

  origin: Vec3;
  velocity = vec3();
  yaw = 0; // degrees; 0 looks down -Z
  pitch = 0;

  onGround = false;
  groundNormal = vec3(0, 1, 0);
  ducked = false;
  duckFrac = 0; // 0 standing, 1 ducked (drives eye lerp)
  onLadder: LadderVolume | null = null;

  /** True while standing on a surf-steep slope (airborne rules, no friction). */
  surfing = false;

  // Interpolation snapshots (position + eye height per tick).
  prevPos: Vec3;
  currPos: Vec3;
  prevEye = EYE_STAND;
  currEye = EYE_STAND;

  landPunch = 0; // downward view offset from landing, decays each tick

  /** 0..settings.stamina.max; only meaningful while settings.stamina.enabled. */
  stamina = 0;
  /** Quality of the most recent takeoff; only set while settings.perf.enabled. */
  lastHopQuality: 'perfect' | 'grey' | 'normal' | null = null;

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
  ladderCooldown = 0; // seconds before ladder can re-grip after jump-off
  fallVelocity = 0;
  groundTicksSinceLanding = 0; // ground-friction ticks elapsed since landing
  stuckTicks = 0;
  blockedTicks = 0;
  contactsThisTick: string[] = [];

  // Scratch vectors — reused across ticks to avoid allocation.
  readonly wishDir = vec3();
  readonly moveEnd = vec3();
  readonly tmpA = vec3();
  readonly tmpB = vec3();

  // Rolling per-tick history for dumpMovementLog(). Not part of
  // MovementContext — this is PlayerController's own diagnostic API.
  private tickCount = 0;
  private readonly tickHistory: string[] = [];
  private readonly spawn: Vec3;

  constructor(world: World, settings: Settings, spawn: Vec3, opts: PlayerOptions = {}) {
    this.world = world;
    this.settings = settings;
    this.log = opts.log ?? (() => {});
    this.rng = opts.rng ?? Math.random;
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
    return this.tickHistory.join('\n');
  }

  get mins(): Vec3 {
    return this.ducked ? DUCK_MINS : STAND_MINS;
  }

  get maxs(): Vec3 {
    return this.ducked ? DUCK_MAXS : STAND_MAXS;
  }

  get eyeHeight(): number {
    return EYE_STAND + (EYE_DUCK - EYE_STAND) * this.duckFrac;
  }

  get horizontalSpeed(): number {
    return length2D(this.velocity);
  }

  // -- Input ----------------------------------------------------------------

  bindInput(target: HTMLElement): void {
    const keyMap: Record<string, keyof InputState | undefined> = {
      KeyW: 'forward',
      KeyS: 'back',
      KeyA: 'left',
      KeyD: 'right',
      Space: 'jump',
      ShiftLeft: 'walk',
      ControlLeft: 'duck',
      KeyC: 'duck',
      KeyR: 'reset',
    };
    window.addEventListener('keydown', (e) => {
      const action = keyMap[e.code];
      if (action) {
        this.input[action] = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const action = keyMap[e.code];
      if (action) this.input[action] = false;
    });

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
    this.onLadder = null;
    this.ducked = false;
    this.stamina = 0;
    this.groundTicksSinceLanding = 0;
    this.lastHopQuality = null;
  }

  // -- Simulation -----------------------------------------------------------

  tick(dt: number): void {
    copy(this.prevPos, this.currPos);
    this.prevEye = this.currEye;

    if (this.input.reset) {
      this.input.reset = false;
      this.respawn();
    }

    if (this.ladderCooldown > 0) this.ladderCooldown -= dt;
    updateDuck(this);
    if (this.settings.stamina.enabled) {
      this.stamina = recoverStamina(this.stamina, this.settings.stamina.recoveryRate, this.settings.stamina.max, dt);
    }

    if (!checkStuck(this)) {
      const ladder = checkLadder(this);
      if (ladder) {
        ladderMove(this, dt, ladder);
      } else {
        this.onLadder = null;
        checkJump(this);
        if (this.onGround) {
          walkMove(this, dt);
          this.groundTicksSinceLanding++;
        } else {
          this.fallVelocity = -this.velocity.y;
          airMove(this, dt);
        }
        categorizePosition(this);
      }
    }

    detectBlockedMove(this);

    // Landing view punch (render-only, optional).
    this.landPunch *= Math.max(0, 1 - 10 * dt);
    this.oldJump = this.input.jump;
    this.recordTick();

    // Duck eye-height lerp.
    const target = this.ducked ? 1 : 0;
    const rate = dt / DUCK_LERP_TIME;
    this.duckFrac += Math.sign(target - this.duckFrac) * Math.min(rate, Math.abs(target - this.duckFrac));

    copy(this.currPos, this.origin);
    this.currEye = this.eyeHeight;
  }

  private recordTick(): void {
    const o = this.origin;
    const v = this.velocity;
    const i = this.input;
    const keys =
      (i.forward ? 'W' : '') +
      (i.back ? 'S' : '') +
      (i.left ? 'A' : '') +
      (i.right ? 'D' : '') +
      (i.jump ? 'J' : '') +
      (i.duck ? 'C' : '') +
      (i.walk ? 'H' : '');
    const flags =
      (this.onGround ? 'G' : 'A') + (this.surfing ? 's' : '') + (this.onLadder ? 'L' : '') + (this.ducked ? 'd' : '');
    const contacts = this.contactsThisTick.length > 0 ? ` c[${this.contactsThisTick.join(' ')}]` : '';
    this.tickHistory.push(
      `${this.tickCount++} p ${o.x.toFixed(1)},${o.y.toFixed(1)},${o.z.toFixed(1)} ` +
        `v ${v.x.toFixed(1)},${v.y.toFixed(1)},${v.z.toFixed(1)} ${flags} in:${keys || '-'}${contacts}`,
    );
    if (this.tickHistory.length > 384) this.tickHistory.shift();
    this.contactsThisTick = [];
  }
}
