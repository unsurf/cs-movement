# @unsurf/cs-movement

Counter-Strike / Source-engine movement physics as a standalone library:
bhop, surf, air-strafing, ladders, ducking, and plane-based brush collision.

Renderer-agnostic and **zero runtime dependencies** — no Three.js, no engine.
You bring the geometry and the draw loop; this brings the feel.

## What's in it

- **Movement** — `sv_accelerate` / `sv_airaccelerate` / `sv_friction` faithful to
  CS:GO's cvars, air-speed cap, `sv_enablebunnyhopping 0` takeoff clamp.
- **Collision** — Quake/Source-style box trace against convex brushes: planes are
  Minkowski-expanded by the hull and the move is clipped against them, the same
  scheme as `CM_ClipBoxToBrush`. Surf falls out of the geometry for free, because
  "can I stand here" is just the contact plane's normal.
- **Units** — Source units throughout (1 unit = 1 inch), Y-up. The whole envelope
  is tuned together: 57u jump apex, 18u step, 32×32×72 hull (54 ducked).

## Install

No public npm registry — install straight from GitHub:

```bash
npm i "@unsurf/cs-movement@github:unsurf/cs-movement#semver:^0.1.0"
```

## Use

```ts
import { World, PlayerController, brushFromAABB, vec3, DEFAULT_SETTINGS } from '@unsurf/cs-movement';

const world = new World();
world.solids.push(brushFromAABB(vec3(-512, -16, -512), vec3(512, 0, 512)));

const player = new PlayerController(world, DEFAULT_SETTINGS, vec3(0, 8, 0));
player.bindInput(canvas);           // browser only — WASD + pointer lock
player.tick(1 / 128);               // step the sim; read player.origin each frame
```

The core is headless: `tick()` never touches the DOM, so it runs under node for
tests and server-side simulation. Only `bindInput` and `loadSettings`/
`saveSettings` need a browser.

Anomalies (unstuck pops, velocity kills) go nowhere unless you ask:

```ts
new PlayerController(world, settings, spawn, { log: (m) => console.warn(m) });
```

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
