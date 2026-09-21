# @unsurf/cs-movement

Counter-Strike / Source-engine movement physics as a standalone TypeScript library.

Bhop, surf, air-strafing, ladders, ducking, stamina, and plane-based brush collision.
Renderer-agnostic. Zero runtime dependencies. Runs headless in Node.

```bash
npm i @unsurf/cs-movement
```

## Quick start

### Browser

```ts
import { World, PlayerController, brushFromAABB, vec3, DEFAULT_SETTINGS } from '@unsurf/cs-movement';

const world = new World();
world.solids.push(brushFromAABB(vec3(-512, -16, -512), vec3(512, 0, 512)));

const player = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 8, 0));
player.bindInput(canvas);

function gameLoop(dt: number) {
  player.tick(dt);
  // read player.origin, player.velocity, player.onGround, etc.
}
```

### Headless (Node / server)

```ts
import { World, PlayerController, brushFromAABB, vec3, DEFAULT_SETTINGS } from '@unsurf/cs-movement';

const world = new World();
world.solids.push(brushFromAABB(vec3(-8192, -64, -8192), vec3(8192, 0, 8192)));

const player = new PlayerController(world, structuredClone(DEFAULT_SETTINGS), vec3(0, 5, 0));
player.input.forward = true;
for (let i = 0; i < 512; i++) player.tick(1 / 128);

console.log(player.horizontalSpeed); // ~250
```

## How it works

The simulation is a single `tick(dt)` call that runs the full Source engine pipeline: duck, ladder check, jump, ground/air movement, collision, landing. It mutates the player's own fields — no allocation per tick.

**What you bring:** geometry (brushes), a render loop, and input.
**What this provides:** the physics. Read `player.origin` and `player.velocity` each frame to draw.

### Building a world

```ts
import { World, brushFromAABB, brushFromOrientedBox } from '@unsurf/cs-movement';

const world = new World();

// Flat floor
world.solids.push(brushFromAABB(vec3(-512, -16, -512), vec3(512, 0, 512)));

// Surf ramp — tilt the "up" axis away from vertical
const ramp = brushFromOrientedBox(
  vec3(0, 100, 0),        // center
  vec3(200, 8, 200),      // half-extents
  vec3(1, 0, 0),          // local X
  vec3(0, 0.7, 0.7),      // local Y (tilted = surfable)
  vec3(0, -0.7, 0.7),     // local Z
);
world.solids.push(ramp);

// Ladder
world.ladders.push({
  ...brushFromAABB(vec3(60, 0, -24), vec3(100, 600, 24)),
  facing: vec3(-1, 0, 0),
});
```

### Player fields

| Field | What it is |
| --- | --- |
| `origin`, `velocity` | Position and velocity (Source units/sec) |
| `yaw`, `pitch` | View angles in degrees |
| `onGround`, `groundNormal` | Grounded state + surface normal |
| `ducked`, `duckFrac` | Duck state and 0→1 eye-height lerp |
| `surfing` | True on steep-but-surfable slopes |
| `onLadder` | Current `LadderVolume` or `null` |
| `horizontalSpeed` | `length2D(velocity)` — the HUD number |
| `eyeHeight` | Lerped eye height for current duck state |
| `stamina` | Fatigue pool (only when `settings.stamina.enabled`) |
| `lastHopQuality` | `'perfect'` / `'normal'` / `null` (only when `settings.perf.enabled`) |

### Input

`bindInput(element)` wires WASD/Space/Shift/Ctrl/C/R + pointer-lock mouse + mousewheel bhop. Or drive `player.input` directly:

```ts
player.input.forward = true;
player.input.jump = true;
player.tick(1 / 128);
```

## Settings

Every tunable lives on one `Settings` object, mutated live and read each tick.

```ts
import { DEFAULT_SETTINGS } from '@unsurf/cs-movement';

const settings = structuredClone(DEFAULT_SETTINGS);
settings.autobhop = true;
settings.bhopSpeedClamp = false; // uncapped CS:GO-style bhop
settings.airAccelerate = 100;   // KZ server default (CS:GO is 12)
```

| Setting | Default | What it does |
| --- | --- | --- |
| `autobhop` | `true` | Holding jump re-hops every grounded tick |
| `bhopSpeedClamp` | `true` | Clamps takeoff to 1.1x maxspeed |
| `noPrestrafe` | `true` | Ground speed ceiling prevents prestrafe carry |
| `airAccelerate` | `100` | `sv_airaccelerate` — CS:GO default is `12` |
| `runSpeed` / `walkSpeed` / `crouchSpeed` | `250` / `130` / `85` | Max speeds in units/sec |
| `sensitivity` | `1.5` | Mouse sensitivity |
| `mYaw` | `0.022` | Degrees per mouse count |
| `viewPunch` | `false` | Landing view-punch offset |
| `stamina` | disabled | CS2-style fatigue pool |
| `perf` | disabled | Perfect-bhop velocity carry |

### Bunnyhopping modes

| `autobhop` | `bhopSpeedClamp` | Behavior |
| --- | --- | --- |
| `true` | `true` | KZ/HNS — auto-rehop, speed capped |
| `true` | `false` | Uncapped — speed compounds without bound |
| `false` | either | Vanilla — jump only fires on fresh press |

## API reference

Everything is exported from `@unsurf/cs-movement`.

### Player

- `PlayerController` — the main class. Constructor: `(world, settings, spawn, opts?)`
- `PlayerOptions` — `{ log?: (msg: string) => void }`
- Methods: `tick(dt)`, `respawn()`, `bindInput(el)`, `tickHistoryText()`
- Properties: `origin`, `velocity`, `yaw`, `pitch`, `onGround`, `ducked`, `surfing`, `onLadder`, `input`, `stamina`, `lastHopQuality`, `horizontalSpeed`, `eyeHeight`, `mins`, `maxs`, `prevPos`/`currPos`, `prevEye`/`currEye`, `landingVelocity`, `landPunch`

### World & Collision

- `World` — `{ solids: Brush[], ladders: LadderVolume[] }`
- `brushFromAABB(min, max)` — axis-aligned box
- `brushFromOrientedBox(center, halfExtents, ax, ay, az)` — oriented box
- `traceBox(start, end, mins, maxs)` — hull sweep
- `boxInBrush(origin, mins, maxs, brush)` — containment test
- Types: `Brush`, `LadderVolume`, `Plane`, `TraceResult`

### Settings

- `Settings`, `CrosshairSettings`, `StaminaSettings`, `PerfSettings` — types
- `DEFAULT_SETTINGS` — default values
- `loadSettings()` / `saveSettings()` — localStorage persistence (browser only)

### Math

- `Vec3` type, `vec3(x, y, z)` constructor
- `copy`, `set`, `add`, `sub`, `addScaled`, `scale`, `dot`, `cross`, `length`, `length2D`, `lengthSq`, `normalize`, `clone`

### Physics (pure functions)

- `applyFriction`, `accelerate`, `airAccelerate`, `clipVelocity`
- `addStamina`, `recoverStamina`, `staminaPenaltyMultiplier`
- `applyAirSpeedCeiling`

### Constants

`GRAVITY`, `RUN_SPEED`, `WALK_SPEED`, `CROUCH_SPEED`, `STANDABLE_NORMAL`, `JUMP_HEIGHT`, `JUMP_VELOCITY`, `HULL_HALF_WIDTH`, `HULL_STAND_HEIGHT`, `HULL_DUCK_HEIGHT`, `EYE_STAND`, `EYE_DUCK`, `LADDER_SPEED`, `STEP_HEIGHT`, `M_YAW`, `PITCH_CLAMP`, plus per-module tunables.

## License

Apache-2.0. Copyright 2026 unsurf. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

Ship `LICENSE` and `NOTICE` with your distribution. Keep `@license` headers intact. Mark modified files.
