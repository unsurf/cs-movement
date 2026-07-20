// Regression test for the "mouse locks up" bug: the pointer-lock spike
// filter in bindInput() must only ever drop a single anomalous frame, never
// every subsequent frame of the same fast-but-legitimate mouse turn.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vec3 } from '../src/math/vec3';
import { World, brushFromAABB } from '../src/physics/Collision';
import { PlayerController } from '../src/player/PlayerController';
import { DEFAULT_SETTINGS } from '../src/settings';

function makeWorld(): World {
  const world = new World();
  world.solids.push(brushFromAABB(vec3(-8192, -64, -8192), vec3(8192, 0, 8192)));
  return world;
}

describe('PlayerController mouse input', () => {
  let target: object;
  let originalDocument: unknown;
  let originalWindow: unknown;

  beforeEach(() => {
    originalDocument = (globalThis as Record<string, unknown>).document;
    originalWindow = (globalThis as Record<string, unknown>).window;
    target = {};
    const doc = Object.assign(new EventTarget(), { pointerLockElement: target });
    const win = new EventTarget();
    (globalThis as Record<string, unknown>).document = doc;
    (globalThis as Record<string, unknown>).window = win;
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).document = originalDocument;
    (globalThis as Record<string, unknown>).window = originalWindow;
  });

  function move(dx: number, dy: number): void {
    const e = new Event('mousemove') as Event & { movementX: number; movementY: number };
    e.movementX = dx;
    e.movementY = dy;
    (globalThis as unknown as { window: EventTarget }).window.dispatchEvent(e);
  }

  it('does not keep filtering after an isolated spike is dropped', () => {
    const player = new PlayerController(makeWorld(), { ...DEFAULT_SETTINGS }, vec3(0, 0, 0));
    player.bindInput(target as HTMLElement);

    move(2, 0); // first sample after (re)lock: unconditionally discarded
    move(3, 0); // small baseline turn, accepted
    const yawAfterBaseline = player.yaw;

    move(400, 0); // huge jump vs. the tiny baseline -> filtered as a spike
    expect(player.yaw).toBe(yawAfterBaseline);

    move(410, 0); // legitimate continuation of the same fast turn
    expect(player.yaw).not.toBe(yawAfterBaseline);
  });
});
