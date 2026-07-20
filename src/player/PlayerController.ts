/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 Liam Grant
 * SPDX-License-Identifier: Apache-2.0
 */
// Per-tick player simulation following Source's CGameMovement pipeline:
// duck -> ladder -> CheckJumpButton -> Friction/Accelerate (ground) or
// AirAccelerate (air/surf) -> gravity halves around TryPlayerMove ->
// CategorizePosition. All state is in Source units, Y-up.

import {
  ACCELERATE,
  BHOP_MAX_SPEED_FACTOR,
  DUCK_LERP_TIME,
  EYE_DUCK,
  EYE_STAND,
  FRICTION,
  GRAVITY,
  GROUND_TRACE_DIST,
  HULL_DUCK_HEIGHT,
  HULL_HALF_WIDTH,
  HULL_STAND_HEIGHT,
  JUMP_VELOCITY,
  LADDER_JUMP_OFF_SPEED,
  LADDER_SPEED,
  MAX_CLIP_PLANES,
  NON_JUMP_VELOCITY,
  OVERBOUNCE_DEFAULT,
  OVERBOUNCE_SURF,
  STANDABLE_NORMAL,
  STEP_HEIGHT,
  STOP_SPEED,
} from '../constants.js';
import {
  type Vec3,
  addScaled,
  clone,
  copy,
  cross,
  dot,
  length,
  length2D,
  lengthSq,
  normalize,
  scale,
  set,
  vec3,
} from '../math/vec3.js';
import {
  accelerate,
  addStamina,
  airAccelerate,
  applyFriction,
  clipVelocity,
  perfBonusFactor,
  recoverStamina,
  staminaPenaltyMultiplier,
} from '../physics/MovementPhysics.js';
import type { LadderVolume, World } from '../physics/Collision.js';
import type { Settings } from '../settings.js';

/** Optional host hooks. Movement never logs or touches globals on its own. */
export interface PlayerOptions {
  /** Called on anomalies (unstuck pops, velocity kills). Default: no-op. */
  log?: (msg: string) => void;
}

const DEG2RAD = Math.PI / 180;

const STAND_MINS = vec3(-HULL_HALF_WIDTH, 0, -HULL_HALF_WIDTH);
const STAND_MAXS = vec3(HULL_HALF_WIDTH, HULL_STAND_HEIGHT, HULL_HALF_WIDTH);
const DUCK_MINS = vec3(-HULL_HALF_WIDTH, 0, -HULL_HALF_WIDTH);
const DUCK_MAXS = vec3(HULL_HALF_WIDTH, HULL_DUCK_HEIGHT, HULL_HALF_WIDTH);

interface InputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  duck: boolean;
  walk: boolean;
  reset: boolean;
}

export class PlayerController {
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

  private oldJump = false; // was +jump held last tick (Source's pogo-stick check)
  private ladderCooldown = 0; // seconds before ladder can re-grip after jump-off
  private fallVelocity = 0;
  private groundTicksSinceLanding = 0; // ground-friction ticks elapsed since landing
  private stuckTicks = 0;
  private blockedTicks = 0;

  // Rolling per-tick history for dumpMovementLog().
  private tickCount = 0;
  private readonly tickHistory: string[] = [];
  /** Host-supplied anomaly sink; no-op unless the embedder passes one. */
  private readonly log: (msg: string) => void;
  private contactsThisTick: string[] = [];
  private readonly spawn: Vec3;

  // Scratch vectors — reused across ticks to avoid allocation.
  private readonly wishDir = vec3();
  private readonly moveEnd = vec3();
  private readonly tmpA = vec3();
  private readonly tmpB = vec3();

  constructor(
    private readonly world: World,
    private readonly settings: Settings,
    spawn: Vec3,
    opts: PlayerOptions = {},
  ) {
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
    // Chromium's pointer lock occasionally emits a single bogus huge
    // movementX/Y (notably right after (re)acquiring the lock or on focus
    // glitches), which reads as the view "snapping". Filter: drop the first
    // event after a lock change, and drop isolated spikes that are both
    // large and far out of line with the previous event.
    let discardNextMouse = true;
    let lastDx = 0;
    let lastDy = 0;
    document.addEventListener('pointerlockchange', () => {
      discardNextMouse = true;
    });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== target) return;
      const dx = e.movementX;
      const dy = e.movementY;
      if (discardNextMouse) {
        discardNextMouse = false;
        lastDx = dx;
        lastDy = dy;
        return;
      }
      const spikeX = Math.abs(dx) > 350 && Math.abs(dx) > 8 * Math.abs(lastDx) + 100;
      const spikeY = Math.abs(dy) > 350 && Math.abs(dy) > 8 * Math.abs(lastDy) + 100;
      if (spikeX || spikeY || Math.abs(dx) > 1200 || Math.abs(dy) > 1200) {
        this.log(`mouse snap filtered (dx ${dx}, dy ${dy})`);
        return;
      }
      lastDx = dx;
      lastDy = dy;
      const sens = this.settings.sensitivity * this.settings.mYaw;
      this.yaw -= dx * sens;
      this.pitch -= dy * sens;
      this.pitch = Math.max(-89, Math.min(89, this.pitch));
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
    this.updateDuck();
    if (this.settings.stamina.enabled) {
      this.stamina = recoverStamina(this.stamina, this.settings.stamina.recoveryRate, this.settings.stamina.max, dt);
    }

    if (!this.checkStuck()) {
      const ladder = this.checkLadder();
      if (ladder) {
        this.ladderMove(dt, ladder);
      } else {
        this.onLadder = null;
        this.checkJump();
        if (this.onGround) {
          this.walkMove(dt);
          this.groundTicksSinceLanding++;
        } else {
          this.fallVelocity = -this.velocity.y;
          this.airMove(dt);
        }
        this.categorizePosition();
      }
    }

    this.detectBlockedMove();

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

  /**
   * Source-style CheckStuck: if the hull starts a tick overlapping solid
   * (possible where brushes overlap, e.g. Λ ramp ridges), nudge it out to the
   * nearest free spot instead of letting the move pipeline grind against
   * geometry it's inside of. Returns true only when hopelessly wedged (then
   * we also kill velocity so gravity can't pump it while pinned).
   */
  private checkStuck(): boolean {
    if (this.world.isPositionFree(this.origin, this.mins, this.maxs)) {
      this.stuckTicks = 0;
      return false;
    }

    const dirs: Array<[number, number, number]> = [
      [0, 1, 0],
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
      [1, 0, 1],
      [-1, 0, 1],
      [1, 0, -1],
      [-1, 0, -1],
      [0, -1, 0],
    ];
    for (const dist of [1, 2, 4, 8, 16, 34]) {
      for (const [dx, dy, dz] of dirs) {
        set(this.tmpA, this.origin.x + dx * dist, this.origin.y + dy * dist, this.origin.z + dz * dist);
        if (this.world.isPositionFree(this.tmpA, this.mins, this.maxs)) {
          if (this.stuckTicks === 0) {
            this.log(
              `unstuck: popped ${dist}u (${dx},${dy},${dz}) from ` +
                `(${this.origin.x.toFixed(1)}, ${this.origin.y.toFixed(1)}, ${this.origin.z.toFixed(1)})`,
            );
          }
          copy(this.origin, this.tmpA);
          this.stuckTicks = 0;
          return false;
        }
      }
    }

    if (this.stuckTicks % 128 === 0) {
      this.log(
        `STUCK: no free spot near (${this.origin.x.toFixed(1)}, ${this.origin.y.toFixed(1)}, ` +
          `${this.origin.z.toFixed(1)}) — velocity zeroed (press R to respawn)`,
      );
    }
    this.stuckTicks++;
    set(this.velocity, 0, 0, 0);
    return true;
  }

  /**
   * Freeze breaker: no legitimate state has large velocity while the
   * position integrates nothing tick after tick — that pattern means the
   * mover is wedged against geometry in a way the clip loop can't resolve
   * (razor-thin float alignments at plane seams). Left alone it becomes a
   * runaway velocity accumulator (gravity keeps getting clip-converted while
   * the position is pinned). Detect it and dump the energy.
   */
  private detectBlockedMove(): void {
    const speed = Math.sqrt(lengthSq(this.velocity));
    const moved = Math.hypot(
      this.origin.x - this.prevPos.x,
      this.origin.y - this.prevPos.y,
      this.origin.z - this.prevPos.z,
    );
    // "Blocked" means truly pinned: real slides move ~speed*dt (a unit or
    // more per tick); the freeze state moves nothing at all.
    if (!this.onGround && speed > 150 && moved < 0.05) {
      this.blockedTicks++;
      if (this.blockedTicks >= 3) {
        this.log(
          `move blocked ${this.blockedTicks} ticks at ` +
            `(${this.origin.x.toFixed(2)}, ${this.origin.y.toFixed(2)}, ${this.origin.z.toFixed(2)}) ` +
            `vel (${this.velocity.x.toFixed(1)}, ${this.velocity.y.toFixed(1)}, ${this.velocity.z.toFixed(1)}) ` +
            `contacts [${this.contactsThisTick.join(' ')}] — velocity zeroed`,
        );
        set(this.velocity, 0, 0, 0);
        this.blockedTicks = 0;
      }
    } else {
      this.blockedTicks = 0;
    }
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

  private currentMaxSpeed(): number {
    let speed: number;
    if (this.ducked) speed = this.settings.crouchSpeed;
    else if (this.input.walk) speed = this.settings.walkSpeed;
    else speed = this.settings.runSpeed;

    if (this.settings.stamina.enabled) {
      speed *= staminaPenaltyMultiplier(this.stamina, this.settings.stamina.max, this.settings.stamina.maxPenalty);
    }
    return speed;
  }

  /** Horizontal wish direction from WASD + yaw. Returns wishspeed. */
  private computeWish(): number {
    const fmove = (this.input.forward ? 1 : 0) - (this.input.back ? 1 : 0);
    const smove = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const yawRad = this.yaw * DEG2RAD;
    const fx = -Math.sin(yawRad);
    const fz = -Math.cos(yawRad);
    const rx = Math.cos(yawRad);
    const rz = -Math.sin(yawRad);

    set(this.wishDir, fx * fmove + rx * smove, 0, fz * fmove + rz * smove);
    const maxspeed = this.currentMaxSpeed();
    const len = normalize(this.wishDir);
    return len > 0 ? Math.min(len * maxspeed, maxspeed) : 0;
  }

  private checkJump(): void {
    if (!this.onGround) return;
    if (!this.input.jump) return;
    // Vanilla behavior: the press must happen on the ground — holding jump
    // from mid-air does nothing on landing. Autobhop skips that check.
    if (!this.settings.autobhop && this.oldJump) return;

    // sv_enablebunnyhopping 0 / nopre: clamp takeoff speed to 1.1 × maxspeed
    // (Source's PreventBunnyJumping), so hops don't compound speed.
    if (this.settings.bhopSpeedClamp) {
      const maxScaled = this.currentMaxSpeed() * BHOP_MAX_SPEED_FACTOR;
      const speed = this.horizontalSpeed;
      if (speed > maxScaled) {
        const fraction = maxScaled / speed;
        this.velocity.x *= fraction;
        this.velocity.z *= fraction;
      }
    }

    if (this.settings.perf.enabled) {
      const bonus = perfBonusFactor(
        this.groundTicksSinceLanding,
        this.settings.perf.greyWindowTicks,
        this.settings.perf.bonusFactor,
      );
      this.lastHopQuality = this.groundTicksSinceLanding <= 0 ? 'perfect' : bonus > 0 ? 'grey' : 'normal';
      if (bonus > 0) {
        this.velocity.x *= 1 + bonus;
        this.velocity.z *= 1 + bonus;
      }
    }

    let jumpVelocity = JUMP_VELOCITY;
    if (this.settings.stamina.enabled) {
      jumpVelocity *= staminaPenaltyMultiplier(this.stamina, this.settings.stamina.max, this.settings.stamina.maxPenalty);
      this.stamina = addStamina(this.stamina, this.settings.stamina.jumpCost, this.settings.stamina.max);
    }
    this.velocity.y = jumpVelocity;
    this.onGround = false;
  }

  private walkMove(dt: number): void {
    this.velocity.y = 0;
    applyFriction(this.velocity, FRICTION, STOP_SPEED, dt);

    const wishspeed = this.computeWish();
    accelerate(this.velocity, this.wishDir, wishspeed, ACCELERATE, dt);
    this.velocity.y = 0;

    if (lengthSq(this.velocity) < 1e-6) {
      set(this.velocity, 0, 0, 0);
      return;
    }

    this.stepMove(dt);
    this.stayOnGround();
  }

  private airMove(dt: number): void {
    const wishspeed = this.computeWish();
    airAccelerate(this.velocity, this.wishDir, wishspeed, this.settings.airAccelerate, dt);

    this.velocity.y -= 0.5 * GRAVITY * dt; // half gravity before the move
    this.tryPlayerMove(dt);
    this.velocity.y -= 0.5 * GRAVITY * dt; // half gravity after
  }

  /**
   * Source's StepMove: run the move directly, then again with an 18-unit
   * step-up first; keep whichever version travelled farther horizontally.
   */
  private stepMove(dt: number): void {
    const startOrigin = clone(this.origin);
    const startVel = clone(this.velocity);

    // Attempt 1: direct.
    this.tryPlayerMove(dt);
    const downOrigin = clone(this.origin);
    const downVel = clone(this.velocity);

    // Attempt 2: up, move, down.
    copy(this.origin, startOrigin);
    copy(this.velocity, startVel);
    let tr = this.world.trace(
      this.origin,
      set(this.tmpA, this.origin.x, this.origin.y + STEP_HEIGHT, this.origin.z),
      this.mins,
      this.maxs,
    );
    if (!tr.startSolid && !tr.allSolid) copy(this.origin, tr.endPos);

    this.tryPlayerMove(dt);

    tr = this.world.trace(
      this.origin,
      set(this.tmpA, this.origin.x, this.origin.y - STEP_HEIGHT, this.origin.z),
      this.mins,
      this.maxs,
    );
    const steppedOntoSteep = tr.fraction < 1 && tr.normal !== null && tr.normal.y < STANDABLE_NORMAL;
    if (!tr.startSolid && !tr.allSolid && !steppedOntoSteep) {
      copy(this.origin, tr.endPos);
    }

    if (steppedOntoSteep) {
      copy(this.origin, downOrigin);
      copy(this.velocity, downVel);
      return;
    }

    const dxUp = this.origin.x - startOrigin.x;
    const dzUp = this.origin.z - startOrigin.z;
    const dxDown = downOrigin.x - startOrigin.x;
    const dzDown = downOrigin.z - startOrigin.z;
    if (dxDown * dxDown + dzDown * dzDown > dxUp * dxUp + dzUp * dzUp) {
      copy(this.origin, downOrigin);
      copy(this.velocity, downVel);
    } else {
      // Keep the stepped result but take the direct move's vertical velocity,
      // as Source does.
      this.velocity.y = downVel.y;
    }
  }

  /** Keep grounded players glued to walkable slopes (Source's StayOnGround). */
  private stayOnGround(): void {
    const tr = this.world.trace(
      this.origin,
      set(this.tmpA, this.origin.x, this.origin.y - STEP_HEIGHT, this.origin.z),
      this.mins,
      this.maxs,
    );
    if (
      tr.fraction > 0 &&
      tr.fraction < 1 &&
      !tr.startSolid &&
      tr.normal !== null &&
      tr.normal.y >= STANDABLE_NORMAL
    ) {
      copy(this.origin, tr.endPos);
    }
  }

  private overbounceFor(normal: Vec3): number {
    // Surf-steep slopes clip with exactly 1.0 so no speed is bled; everything
    // else (floors, walls, ceilings) uses 1.001.
    const ny = normal.y;
    return ny > 0.05 && ny < STANDABLE_NORMAL ? OVERBOUNCE_SURF : OVERBOUNCE_DEFAULT;
  }

  /**
   * Source's TryPlayerMove: sweep, clip velocity against every plane touched
   * this tick (creases slide along the shared edge), repeat up to 4 bumps.
   */
  private tryPlayerMove(dt: number): void {
    let timeLeft = dt;
    const planes: Vec3[] = [];
    const originalVel = clone(this.velocity);
    const primalVel = clone(this.velocity);
    this.surfing = false;

    for (let bump = 0; bump < 4; bump++) {
      if (lengthSq(this.velocity) === 0) break;

      addScaled(this.moveEnd, this.origin, this.velocity, timeLeft);
      const tr = this.world.trace(this.origin, this.moveEnd, this.mins, this.maxs);

      if (tr.allSolid) {
        this.log('tryPlayerMove: allSolid — velocity zeroed');
        set(this.velocity, 0, 0, 0);
        return;
      }
      if (tr.fraction > 0) {
        copy(this.origin, tr.endPos);
        copy(originalVel, this.velocity);
        planes.length = 0;
      }
      if (tr.fraction === 1) break;

      const n = tr.normal!;
      this.contactsThisTick.push(`${n.x.toFixed(2)},${n.y.toFixed(2)},${n.z.toFixed(2)}@${tr.fraction.toFixed(2)}`);

      timeLeft -= timeLeft * tr.fraction;

      if (planes.length >= MAX_CLIP_PLANES) {
        this.log('tryPlayerMove: exceeded MAX_CLIP_PLANES — velocity zeroed');
        set(this.velocity, 0, 0, 0);
        return;
      }
      // Zero-fraction bumps re-report the plane we're already resting
      // against; accumulating the duplicate would make the crease fallback
      // compute cross(n, n) = 0 and kill all velocity (ramp "sticking").
      if (!planes.some((p) => dot(p, tr.normal!) > 0.99)) {
        planes.push(clone(tr.normal!));
      }
      if (tr.normal!.y > 0.05 && tr.normal!.y < STANDABLE_NORMAL) this.surfing = true;

      // Find a clip of the original velocity that doesn't re-enter any plane.
      let i = 0;
      for (; i < planes.length; i++) {
        copy(this.velocity, originalVel);
        clipVelocity(this.velocity, planes[i], this.overbounceFor(planes[i]));
        let ok = true;
        for (let j = 0; j < planes.length; j++) {
          if (j !== i && dot(this.velocity, planes[j]) < 0) {
            ok = false;
            break;
          }
        }
        if (ok) break;
      }

      if (i === planes.length) {
        // No single plane worked — slide along the crease of the first two.
        if (planes.length !== 2) {
          this.log(`tryPlayerMove: cornered by ${planes.length} planes — velocity zeroed`);
          set(this.velocity, 0, 0, 0);
          return;
        }
        cross(this.tmpB, planes[0], planes[1]);
        const creaseLen = normalize(this.tmpB);
        if (creaseLen < 1e-6) {
          // Degenerate (near-parallel planes): fall back to a single clip
          // rather than zeroing the move.
          this.log('tryPlayerMove: degenerate crease — single-plane fallback');
          copy(this.velocity, originalVel);
          clipVelocity(this.velocity, planes[0], this.overbounceFor(planes[0]));
        } else {
          scale(this.velocity, this.tmpB, dot(this.tmpB, this.velocity));
        }
      }

      // If we've been deflected back on ourselves, stop dead (prevents
      // oscillating in corners).
      if (dot(this.velocity, primalVel) <= 0) {
        set(this.velocity, 0, 0, 0);
        return;
      }
    }
  }

  private categorizePosition(): void {
    // Moving up faster than this and we can't be "on" anything.
    if (this.velocity.y > NON_JUMP_VELOCITY) {
      this.setNotGrounded();
      return;
    }

    const tr = this.world.trace(
      this.origin,
      set(this.tmpA, this.origin.x, this.origin.y - GROUND_TRACE_DIST, this.origin.z),
      this.mins,
      this.maxs,
    );

    if (tr.fraction < 1 && !tr.startSolid && tr.normal !== null && tr.normal.y >= STANDABLE_NORMAL) {
      const wasAirborne = !this.onGround;
      this.onGround = true;
      copy(this.groundNormal, tr.normal);
      copy(this.origin, tr.endPos);
      if (wasAirborne) {
        this.groundTicksSinceLanding = 0;
        if (this.settings.stamina.enabled) {
          this.stamina = addStamina(this.stamina, this.settings.stamina.landCost, this.settings.stamina.max);
        }
        if (this.settings.viewPunch && this.fallVelocity > 250) {
          this.landPunch = Math.min((this.fallVelocity - 250) * 0.012, 10);
        }
      }
      this.fallVelocity = 0;
    } else {
      this.setNotGrounded();
    }
  }

  private setNotGrounded(): void {
    this.onGround = false;
  }

  // -- Ladders --------------------------------------------------------------

  private checkLadder(): LadderVolume | null {
    if (this.ladderCooldown > 0) return null;
    const ladder = this.world.ladderAt(this.origin, this.mins, this.maxs);
    if (!ladder) return null;
    if (this.onLadder) return ladder; // already gripping — keep it

    // Only grab when airborne, or when deliberately walking into the ladder.
    if (!this.onGround) return ladder;
    const yawRad = this.yaw * DEG2RAD;
    const facingDot = -Math.sin(yawRad) * -ladder.facing.x + -Math.cos(yawRad) * -ladder.facing.z;
    if (this.input.forward && facingDot > 0.3) return ladder;
    return null;
  }

  private ladderMove(dt: number, ladder: LadderVolume): void {
    this.onLadder = ladder;
    this.onGround = false;
    this.fallVelocity = 0;

    // Jump off: push away from the ladder face.
    if (this.input.jump && !this.oldJump) {
      scale(this.velocity, ladder.facing, LADDER_JUMP_OFF_SPEED);
      this.ladderCooldown = 0.25;
      this.onLadder = null;
      this.tryPlayerMove(dt);
      return;
    }

    const fmove = (this.input.forward ? 1 : 0) - (this.input.back ? 1 : 0);
    const smove = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);

    // Full 3D view basis — looking up + forward climbs up, looking down descends.
    const yawRad = this.yaw * DEG2RAD;
    const pitchRad = this.pitch * DEG2RAD;
    const cp = Math.cos(pitchRad);
    const fwd = set(this.tmpA, -Math.sin(yawRad) * cp, Math.sin(pitchRad), -Math.cos(yawRad) * cp);
    const right = set(this.tmpB, Math.cos(yawRad), 0, -Math.sin(yawRad));

    // Each input axis contributes its FULL climb-speed scale — deliberately
    // not normalized, exactly like Source. This is what makes CS:GO
    // fastclimb work: aiming diagonally into the ladder and holding
    // W+strafe stacks both contributions for ~1.41x climb speed.
    const wish = this.wishDir;
    set(
      wish,
      (fwd.x * fmove + right.x * smove) * LADDER_SPEED,
      (fwd.y * fmove + right.y * smove) * LADDER_SPEED,
      (fwd.z * fmove + right.z * smove) * LADDER_SPEED,
    );
    const wlen = length(wish);
    if (wlen === 0) {
      set(this.velocity, 0, 0, 0);
      return;
    }
    // Cap at the authentic fastclimb maximum (sqrt2 x climb speed).
    const maxWish = LADDER_SPEED * Math.SQRT2;
    if (wlen > maxWish) scale(wish, wish, maxWish / wlen);

    // Split the wish into lateral (along the ladder plane) and into-wall
    // parts; redirect the into-wall part along the ladder's climb direction.
    const n = ladder.facing;
    const normalVel = dot(wish, n);
    const lateral = set(this.tmpA, wish.x - n.x * normalVel, wish.y - n.y * normalVel, wish.z - n.z * normalVel);

    const up = set(this.tmpB, 0, 1, 0);
    const along = cross(vec3(), n, up); // horizontal, along the wall
    const climbDir = cross(vec3(), along, n); // straight up the ladder face
    normalize(climbDir);

    set(
      this.velocity,
      lateral.x + climbDir.x * -normalVel,
      lateral.y + climbDir.y * -normalVel,
      lateral.z + climbDir.z * -normalVel,
    );

    this.tryPlayerMove(dt);
  }

  // -- Duck -----------------------------------------------------------------

  private updateDuck(): void {
    const want = this.input.duck;
    if (want && !this.ducked) {
      this.ducked = true;
      if (!this.onGround) {
        // In-air duck pulls the feet up so the head stays put (lets you duck
        // onto ledges, as in CS).
        const delta = HULL_STAND_HEIGHT - HULL_DUCK_HEIGHT;
        set(this.tmpA, this.origin.x, this.origin.y + delta, this.origin.z);
        if (this.world.isPositionFree(this.tmpA, DUCK_MINS, DUCK_MAXS)) {
          this.origin.y += delta;
        }
      }
    } else if (!want && this.ducked) {
      this.tryUnduck();
    }
  }

  private tryUnduck(): void {
    if (this.onGround) {
      if (this.world.isPositionFree(this.origin, STAND_MINS, STAND_MAXS)) {
        this.ducked = false;
      }
      return;
    }
    // In air: put the feet back down if there's room, else stand in place.
    const delta = HULL_STAND_HEIGHT - HULL_DUCK_HEIGHT;
    set(this.tmpA, this.origin.x, this.origin.y - delta, this.origin.z);
    if (this.world.isPositionFree(this.tmpA, STAND_MINS, STAND_MAXS)) {
      this.origin.y -= delta;
      this.ducked = false;
    } else if (this.world.isPositionFree(this.origin, STAND_MINS, STAND_MAXS)) {
      this.ducked = false;
    }
  }
}
