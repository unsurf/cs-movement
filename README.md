# @unsurf/cs-movement

Counter-Strike / Source-engine movement physics as a standalone library:
bhop, surf, air-strafing, ladders, ducking, stamina, and plane-based brush
collision.

Renderer-agnostic and **zero runtime dependencies** — no Three.js, no engine.
You bring the geometry and the draw loop; this brings the feel.

- **Movement** — `sv_accelerate` / `sv_airaccelerate` / `sv_friction` faithful
  to CS:GO's cvars, the air-speed cap, the `sv_enablebunnyhopping 0` takeoff
  clamp, plus two opt-in extras: a manual-timing "perf" bhop bonus and a
  CS2-style stamina pool.
- **Collision** — Quake/Source-style box trace against convex brushes: planes
  are Minkowski-expanded by the hull and the move is clipped against them, the
  same scheme as `CM_ClipBoxToBrush`. Surf falls out of the geometry for free,
  because "can I stand here" is just the contact plane's normal.
- **Units** — Source units throughout (1 unit = 1 inch), Y-up. The whole
  envelope is tuned together: 57u jump apex, 18u step, 32×32×72 hull (54
  ducked).
- **Headless** — the simulation core has no DOM dependency and runs under
  Node, so it's fully unit-testable and usable server-side (anti-cheat replay
  validation, deterministic lockstep, etc.).

## Install

No public npm registry — install straight from GitHub:

```bash
npm i "@unsurf/cs-movement@github:unsurf/cs-movement#semver:^0.1.0"
```

## Quick start

```ts
import { World, PlayerController, brushFromAABB, vec3, DEFAULT_SETTINGS } from '@unsurf/cs-movement';

// 1. Build the world out of convex brushes.
const world = new World();
world.solids.push(brushFromAABB(vec3(-512, -16, -512), vec3(512, 0, 512))); // a floor

// 2. Spawn a player.
const player = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 8, 0));

// 3. Browser only: wire up WASD + pointer-lock mouse look.
player.bindInput(canvas);

// 4. Step the simulation at a fixed tick rate and read state back each frame.
function fixedUpdate(dt: number) {
  player.tick(dt); // dt in seconds, e.g. 1/128 for a 128-tick server
}

// player.origin, player.velocity, player.onGround, player.horizontalSpeed, ...
```

`tick()` never touches the DOM — it runs identically in a browser, in Node,
or on a server. Only `bindInput()` and `loadSettings()`/`saveSettings()` need
`window`/`document`/`localStorage`.

## Core concepts

### `World` and brushes

`World` holds the collision geometry: a flat list of `solids: Brush[]` and,
optionally, `ladders: LadderVolume[]`. A `Brush` is a convex shape defined by
its bounding planes — build one with:

```ts
// Axis-aligned box, given opposite corners.
brushFromAABB(min: Vec3, max: Vec3): Brush

// Arbitrarily oriented box — center, half-extents, and an orthonormal
// local x/y/z basis. Use this for ramps and surf: tilt `ay` (the local
// "up" axis) away from world-up and the resulting brush's top face becomes
// a walkable-or-surfable slope, decided purely by its normal (see
// STANDABLE_NORMAL below — no separate "is this a ramp" flag exists).
brushFromOrientedBox(center: Vec3, halfExtents: Vec3, ax: Vec3, ay: Vec3, az: Vec3): Brush
```

A `LadderVolume` is a `Brush` plus a horizontal `facing` vector (the
direction the climbable face points, away from the wall):

```ts
world.ladders.push({
  ...brushFromAABB(vec3(60, 0, -24), vec3(100, 600, 24)),
  facing: vec3(-1, 0, 0),
});
```

`World` also exposes the two lower-level queries the movement code is built
on, useful if you're doing your own raycasts or spawn-point validation:

```ts
world.trace(start, end, mins, maxs): TraceResult        // sweep a hull, get the first hit
world.isPositionFree(origin, mins, maxs): boolean        // does the hull fit here right now?
world.ladderAt(origin, mins, maxs): LadderVolume | null  // which ladder (if any) contains this hull?
```

### `PlayerController` and the tick loop

`PlayerController` is the whole simulation: one `tick(dt)` call runs duck →
ladder-check → jump-check → ground-or-air movement → collision → landing, in
that order, mutating the controller's own fields (no allocation per tick).

```ts
new PlayerController(world: World, settings: Settings, spawn: Vec3, opts?: PlayerOptions)
```

`opts` is for host integration, not gameplay:

```ts
interface PlayerOptions {
  log?: (msg: string) => void; // anomalies: unstuck pops, blocked-move velocity kills
  rng?: () => number;          // source for the autobhop perf-chance roll; inject for deterministic tests
}
```

Read these each frame to render:

| Field                    | Meaning                                                        |
| ------------------------ | --------------------------------------------------------------- |
| `origin`, `velocity`     | World-space position and velocity (Source units/sec)            |
| `yaw`, `pitch`           | View angles in degrees (mutate directly, or use `bindInput`)    |
| `onGround`, `groundNormal` | Grounded state and the standing surface's normal               |
| `ducked`, `duckFrac`     | Duck state and 0→1 eye-height lerp progress                     |
| `surfing`                | True while riding a steep-but-standable-adjacent slope           |
| `onLadder`                | The `LadderVolume` currently gripped, or `null`                 |
| `horizontalSpeed`        | Getter: `length2D(velocity)` — the number CS players actually watch |
| `eyeHeight`              | Getter: lerped eye height for the current duck state             |
| `mins`, `maxs`           | Getters: the current (stand or duck) hull extents                |
| `stamina`, `lastHopQuality` | Only meaningful with `settings.stamina`/`settings.perf` enabled |
| `landPunch`              | Downward view-punch offset from a hard landing, decays each tick (render-only, needs `settings.viewPunch`) |
| `prevPos`/`currPos`, `prevEye`/`currEye` | Per-tick snapshots for render interpolation between fixed steps |

Other methods:

```ts
player.respawn(): void            // reset to the spawn point passed to the constructor
player.tickHistoryText(): string  // last 384 ticks as one string, for bug reports/replays
player.bindInput(target: HTMLElement): void // browser only: WASD/Space/Shift/Ctrl/C/R + pointer-lock mouse look
```

`player.input` (`forward`/`back`/`left`/`right`/`jump`/`duck`/`walk`/`reset`)
is a plain mutable object — drive it yourself for AI, replays, or a custom
input scheme instead of calling `bindInput`.

## Settings

Every tunable lives on one `Settings` object, passed into the
`PlayerController` constructor and read fresh every tick — mutate it live and
the next tick picks it up.

```ts
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@unsurf/cs-movement';

const settings = structuredClone(DEFAULT_SETTINGS); // or loadSettings() in a browser
```

| Field | Default | Meaning |
| --- | --- | --- |
| `sensitivity` | `1.5` | Mouse sensitivity multiplier |
| `mYaw` | `0.022` | Degrees per mouse count (CS:GO's `m_yaw`/`m_pitch`) |
| `fov` | `90` | Horizontal FOV, CS:GO 4:3 terms (render-only; the sim doesn't use it) |
| `tickRate` | `128` | Advisory — you choose the actual `dt` passed to `tick()` |
| `autobhop` | `true` | `sv_autobunnyhopping 1` — holding jump keeps hopping |
| `bhopSpeedClamp` | `true` | `sv_enablebunnyhopping 0` — clamps takeoff speed to 1.1× maxspeed so hops can't compound speed. Set `false` for uncapped CS:GO-style bhop |
| `noPrestrafe` | `true` | "nopre" — stops angled strafing, on the ground or in the air, from adding speed beyond the current ground max speed. Doesn't touch speed you already have from a takeoff bonus or an uncapped bhop chain, and doesn't affect surfing |
| `airAccelerate` | `100` | `sv_airaccelerate` — this default is KZ/HNS-server tuned; CS:GO's default is `12` |
| `runSpeed` / `walkSpeed` / `crouchSpeed` | `250` / `130` / `85` | Flat max speeds, not percentages |
| `showSpeed` / `showFps` / `showDebug` | `true` | HUD toggles — informational only, the sim ignores them |
| `viewPunch` | `false` | Enables `landPunch` on hard landings |
| `crosshair` | see below | Crosshair render settings — cosmetic only, the sim ignores them |
| `stamina` | see below | CS2-style stamina pool, **disabled by default** |
| `perf` | see below | Manual-timing bhop bonus, **disabled by default** |

`crosshair`, `stamina`, and `perf` are nested objects (`CrosshairSettings`,
`StaminaSettings`, `PerfSettings` — all exported if you want to type your own
UI against them).

### Bunnyhopping modes

| `autobhop` | `bhopSpeedClamp` | Behavior |
| --- | --- | --- |
| `true` | `true` (default) | Holding jump re-hops every tick you're grounded; takeoff speed capped at 1.1× maxspeed — the KZ/HNS feel |
| `true` | `false` | Same auto-rehop, but no takeoff clamp — speed compounds without bound, pure CS:GO pre-nerf bhop |
| `false` | either | Vanilla: a jump only fires if `+jump` was *not* already held last tick (Source's pogo-stick rule) |

### No Prestrafe ("nopre")

`bhopSpeedClamp` only clamps speed at the instant of a ground→air takeoff.
It says nothing about what happens *while moving* — and both `accelerate()`
(ground) and `airAccelerate()` (air) compare their addspeed cap against
`dot(velocity, wishdir)` rather than `|velocity|`, so continuously turning
your wish direction while holding a strafe key gains speed past maxspeed
either way. In the air that's the deliberate, documented asymmetry that
makes bhop/air-strafe technique work at all (see `airAccelerate` above); on
the ground, at this codebase's tuning, friction alone doesn't fully
suppress the same trick.

`noPrestrafe: true` (the default) caps *both*: it stops turning-strafe
accel from adding **new** speed past your current ground max speed, on the
ground or in the air. It's careful about what it doesn't touch, though — it
never claws back speed you already have from somewhere else (a
`bhopSpeedClamp: false` chain, a `perf` takeoff bonus), so it composes with
those instead of silently overriding them, and it's exempt while
`player.surfing` is true — riding a ramp is expected to exceed run speed;
that's the whole point of surf.

### Perf bonus — manual-timing reward

```ts
interface PerfSettings {
  enabled: boolean;         // default false
  greyWindowTicks: number;  // default 4
  bonusFactor: number;      // default 0.05 — +5% takeoff speed at 0 ticks late
  autobhopChance: number;   // default 0.42
}
```

With `perf.enabled`, a takeoff on the very first tick after landing (the
earliest possible manual rejump) gets a `bonusFactor` takeoff-speed
multiplier, tapering linearly to 0 over `greyWindowTicks`. This rewards
*timing* on top of the vanilla "skip a tick of ground friction" effect — it
doesn't replace it, and it stacks with either bhop mode above.

Because held-jump autobhop always re-fires on the earliest possible tick,
the tick-based classification would make every hop "perfect" — a guaranteed
buff, not a bonus. So under `autobhop`, each hop instead rolls
`autobhopChance` for whether it counts as perfect. `player.lastHopQuality`
(`'perfect' | 'grey' | 'normal' | null`) reports which one just happened —
flash a HUD element off it, drive an audio cue, whatever you like.

### Stamina

```ts
interface StaminaSettings {
  enabled: boolean;      // default false
  max: number;           // default 1 — the pool's ceiling
  jumpCost: number;      // default 0.08 — fraction of max added per jump
  landCost: number;      // default 0.05 — fraction of max added per landing
  recoveryRate: number;  // default 0.5 — fraction of max recovered per second
  maxPenalty: number;    // default 0.4 — speed/jump-velocity cut at a full pool
}
```

A CS2-style fatigue pool: jumping and landing fill it, it drains back to 0
over time, and while it's full-ish both ground speed and jump velocity are
throttled by up to `maxPenalty`. Off by default — every bhop-focused preset,
including `perf`, plays with this disabled, matching servers that zero the
cvars out. Read `player.stamina` (`0..settings.stamina.max`) directly for a
HUD meter.

### Ducking

Hold `input.duck`; `player.ducked` flips once there's room, and
`player.duckFrac` (0→1) lerps over `DUCK_LERP_TIME` (0.2s) for smooth eye
height and hull-size transitions. Ducking mid-air pulls the feet up so the
head stays put — you can duck onto ledges, same as CS. The hull shrinks from
32×32×72 standing to 32×32×54 ducked.

### Ladders

Walk into a ladder volume facing it (or touch one mid-air) to grip it.
Climbing uses the full 3D view basis — looking up while holding forward
climbs, looking down descends — and, matching CS:GO, the forward/strafe
inputs are **not normalized**, so aiming diagonally into the ladder and
holding W+strafe stacks both contributions for CS:GO's authentic ~1.41×
"fastclimb". Press jump to push off in the direction the ladder faces.

### Surf

There's no separate surf mode or flag to enable — it falls directly out of
collision. Any brush face whose normal is too steep to stand on
(`normal.y < STANDABLE_NORMAL`, ~45.57°) but not vertical gets clipped with
`OVERBOUNCE_SURF` (no speed loss) instead of the ordinary
`OVERBOUNCE_DEFAULT`, and `player.surfing` goes `true` while a contact plane
qualifies. Build a ramp with `brushFromOrientedBox` and tilt it into that
range.

## Diagnostics

```ts
new PlayerController(world, settings, spawn, {
  log: (msg) => console.warn('[movement]', msg),
});
```

The `log` hook fires on genuine anomalies only — a `checkStuck` unstuck pop,
a blocked-move velocity kill, a degenerate collision crease — never on
routine ticks. `player.tickHistoryText()` returns the last 384 ticks
(position, velocity, flags, inputs, contact planes) as one newline-joined
string, handy for pasting into a bug report or replaying a repro.

## Headless usage & testing

Nothing in `tick()` touches the DOM, so you can simulate entirely in Node —
this is exactly how the library's own test suite works:

```ts
import { World, PlayerController, brushFromAABB, vec3, DEFAULT_SETTINGS } from '@unsurf/cs-movement';

const world = new World();
world.solids.push(brushFromAABB(vec3(-8192, -64, -8192), vec3(8192, 0, 8192)));

const player = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 5, 0));
player.input.forward = true;
for (let i = 0; i < 512; i++) player.tick(1 / 128); // 4 seconds at 128 ticks/sec

console.log(player.horizontalSpeed); // ~250 — capped at runSpeed
```

Inject `rng` in tests wherever you need the autobhop perf-chance roll to be
deterministic instead of `Math.random`.

## API reference

Everything below is exported from the package root (`@unsurf/cs-movement`).

**Math** — `Vec3`, `vec3`, `copy`, `set`, `add`, `sub`, `addScaled`, `scale`,
`dot`, `cross`, `length`, `length2D`, `lengthSq`, `normalize`, `clone`

**Constants** — `GRAVITY`, `RUN_SPEED`, `WALK_SPEED`, `CROUCH_SPEED`,
`STANDABLE_NORMAL`, `DEFAULT_TICK_RATE`, `MAX_FRAME_TIME`, plus each
feature's own tunables: `FRICTION`/`STOP_SPEED`, `ACCELERATE`,
`AIR_ACCELERATE`/`AIR_SPEED_CAP`, `OVERBOUNCE_SURF`/`OVERBOUNCE_DEFAULT`,
`DIST_EPSILON`, `JUMP_HEIGHT`/`JUMP_VELOCITY`/`BHOP_MAX_SPEED_FACTOR`,
`HULL_HALF_WIDTH`/`HULL_STAND_HEIGHT`/`HULL_DUCK_HEIGHT`/`EYE_STAND`/`EYE_DUCK`/`DUCK_LERP_TIME`,
`LADDER_SPEED`/`LADDER_JUMP_OFF_SPEED`, `STEP_HEIGHT`, `MAX_CLIP_PLANES`,
`NON_JUMP_VELOCITY`/`GROUND_TRACE_DIST`, `M_YAW`/`PITCH_CLAMP`

**Physics (pure functions)** — `applyFriction`, `accelerate`, `airAccelerate`,
`clipVelocity`, `addStamina`, `recoverStamina`, `staminaPenaltyMultiplier`,
`perfBonusFactor`

**Collision** — `Plane`, `Brush`, `LadderVolume`, `TraceResult`,
`brushFromAABB`, `brushFromOrientedBox`, `traceBox`, `boxInBrush`, `World`

**Settings** — `Settings`, `CrosshairSettings`, `StaminaSettings`,
`PerfSettings`, `DEFAULT_SETTINGS`, `loadSettings`, `saveSettings`

**Player** — `PlayerController`, `PlayerOptions`

> `loadSettings`/`saveSettings` persist to a fixed `localStorage` key —
> browser-only, and shared across every consumer on the same origin. Roll
> your own persistence if you need per-app storage.

### Package layout

The source mirrors this reference one behavior per folder — e.g. the bhop
takeoff logic lives in `player/Jump/Jump.ts` next to its own
`Jump.config.ts` (tunables) and `Jump.test.ts`. `PlayerController` is a thin
orchestrator that implements a shared `MovementContext` and calls into each
behavior in sequence; if you're digging into *why* something moves the way
it does, that's the file to start from.

## Attribution — please read

Licensed under **Apache-2.0**. You can use it commercially and in closed-source
products, but the license is not decoration:

1. Ship the `LICENSE` and `NOTICE` files with your distribution — including
   bundled and minified builds.
2. Keep the `@license` header comments intact. Terser and esbuild preserve them
   by default; don't configure that away.
3. Mark any files you modify as changed.
4. Don't use "unsurf" or the author's name to endorse or promote your product.

Credit is the price. It's a low one — honour it.

## License

Copyright 2026 unsurf. Licensed under the Apache License, Version 2.0.
See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
