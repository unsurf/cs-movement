// Regression test for the "mouse locks up" bug: the pointer-lock spike
// filter must only ever drop a single anomalous frame, never every
// subsequent frame of the same fast-but-legitimate mouse turn.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { World } from '../../physics/World/World';
import { brushFromAABB } from '../../physics/Collision/Collision';
import { PlayerController } from '../PlayerController';
import { DEFAULT_SETTINGS } from '../../settings/Settings';

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
    const win = Object.assign(new EventTarget(), { setTimeout, clearTimeout });
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

  it('mwheelup/mwheeldown queues +jump for exactly the next tick, then releases itself', () => {
    const player = new PlayerController(makeWorld(), { ...DEFAULT_SETTINGS }, vec3(0, 0, 0));
    player.bindInput(target as HTMLElement);
    const dt = 1 / DEFAULT_SETTINGS.tickRate;

    const wheel = new Event('wheel', { cancelable: true }) as Event & { deltaY: number };
    wheel.deltaY = 100;
    (globalThis as unknown as { window: EventTarget }).window.dispatchEvent(wheel);

    player.tick(dt);
    expect(player.input.jump).toBe(true); // the tick right after the event sees it pressed

    player.tick(dt);
    expect(player.input.jump).toBe(false); // released itself — no keyup event exists for a wheel notch
  });

  it('a burst of wheel events between two ticks collapses into one press, but a fresh event after release re-arms a new one', () => {
    // A real physical scroll (bottom notch to top notch in one motion)
    // fires roughly a dozen-plus separate 'wheel' events — each one a
    // genuine, independent +jump/-jump pair, not duplicate noise for a
    // single notch. That's the actual mechanism behind chasemod wheel-bhop:
    // spamming +jump repeatedly gives many independent chances for one
    // press to land on the exact tick after a landing and catch a perfect
    // rejump. Two earlier, wall-clock-timed approaches both broke this: one
    // re-armed a single shared release timer on every event (stretching the
    // hold across the whole burst), the other ignored every event after the
    // first (collapsing a real 20-try spam down to a single try) — either
    // way, oldJump stayed true for far too long and permanently blocked the
    // pogo-stick re-press check a manual rejump needs to pass. Tying the
    // release to ticks instead of milliseconds sidesteps the whole
    // timing question: any events queued between two ticks legitimately
    // batch into that tick's single press (matching Source's own
    // per-command-frame batching), while an event arriving after the
    // previous press was already consumed always re-arms a genuinely fresh
    // one — so a spam spread across many ticks gets many independent
    // chances, never one long merged hold.
    const player = new PlayerController(makeWorld(), { ...DEFAULT_SETTINGS }, vec3(0, 0, 0));
    player.bindInput(target as HTMLElement);
    const win = (globalThis as unknown as { window: EventTarget }).window;
    const dt = 1 / DEFAULT_SETTINGS.tickRate;

    function fireWheel(): void {
      const wheel = new Event('wheel', { cancelable: true }) as Event & { deltaY: number };
      wheel.deltaY = 100;
      win.dispatchEvent(wheel);
    }

    for (let i = 0; i < 15; i++) fireWheel(); // a whole burst before the next tick is even read
    player.tick(dt);
    expect(player.input.jump).toBe(true);

    player.tick(dt);
    expect(player.input.jump).toBe(false); // no further events queued -> releases

    fireWheel(); // a later, independent scroll notch
    player.tick(dt);
    expect(player.input.jump).toBe(true); // fresh press, not blocked by the earlier burst
  });
});
