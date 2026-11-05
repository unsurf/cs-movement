import { describe, expect, it } from 'vitest';
import { vec3 } from '../../math/vec3';
import { brushFromAABB } from '../../physics/Collision/Collision';
import { World } from '../../physics/World/World';
import { PlayerController } from '../../player/PlayerController';
import { DEFAULT_SETTINGS } from '../Settings';
import { PRESET_NAMES, PRESETS, applyPreset } from './Presets';

const DT = 1 / 128;

describe('presets', () => {
  it('defines every named preset', () => {
    for (const name of PRESET_NAMES) expect(PRESETS[name].label.length).toBeGreaterThan(0);
  });

  it('applyPreset keeps non-movement settings and does not mutate the base', () => {
    const base = structuredClone(DEFAULT_SETTINGS);
    base.sensitivity = 2.5;
    base.crosshair.color = '#ff00ff';
    const kz = applyPreset(base, 'kz');
    expect(kz.sensitivity).toBe(2.5);
    expect(kz.crosshair.color).toBe('#ff00ff');
    expect(kz.airAccelerate).toBe(100);
    expect(base.airAccelerate).toBe(DEFAULT_SETTINGS.airAccelerate);
    kz.physics.accelerate = 99;
    expect(PRESETS.kz.settings.physics.accelerate).toBe(6.5);
  });

  it('matches the GOKZ mode plugins for the cvars they pin', () => {
    expect(PRESETS.vanilla.settings).toMatchObject({ airAccelerate: 12, bhopSpeedClamp: true, autobhop: false });
    expect(PRESETS.vanilla.settings.stamina.enabled).toBe(true);
    expect(PRESETS.kz.settings.physics).toMatchObject({ accelerate: 6.5, friction: 5.2, maxVelocity: 3500, ladderScaleSpeed: 1 });
    expect(PRESETS.kzTimer.settings.physics).toMatchObject({ accelerate: 6.5, friction: 5, maxVelocity: 2000 });
    expect(PRESETS.kz.settings.stamina.enabled).toBe(false);
  });

  it('surf and bhop servers allow uncapped hopping; bhop auto-hops', () => {
    expect(PRESETS.surf.settings).toMatchObject({ airAccelerate: 150, bhopSpeedClamp: false });
    expect(PRESETS.bhop.settings).toMatchObject({ autobhop: true, bhopSpeedClamp: false });
  });

  it('physics settings really drive the simulation (friction slows a slide)', () => {
    const run = (friction: number): number => {
      const world = new World();
      world.solids.push(brushFromAABB(vec3(-4096, -16, -4096), vec3(4096, 0, 4096)));
      const settings = structuredClone(DEFAULT_SETTINGS);
      settings.physics.friction = friction;
      const p = new PlayerController(world, settings, vec3(0, 0.5, 0));
      for (let i = 0; i < 8; i++) p.tick(DT);
      p.velocity.x = 200;
      for (let i = 0; i < 32; i++) p.tick(DT);
      return p.horizontalSpeed;
    };
    expect(run(0)).toBeGreaterThan(run(5.2) + 20);
  });

  it('kz lets a landed hop keep speed; vanilla clamps it', () => {
    const hop = (name: (typeof PRESET_NAMES)[number]): number => {
      const world = new World();
      world.solids.push(brushFromAABB(vec3(-8192, -16, -8192), vec3(8192, 0, 8192)));
      const p = new PlayerController(world, applyPreset(DEFAULT_SETTINGS, name), vec3(0, 0.5, 0));
      for (let i = 0; i < 8; i++) p.tick(DT);
      p.velocity.x = 400;
      p.input.jump = true;
      p.tick(DT);
      return p.horizontalSpeed;
    };
    expect(hop('vanilla')).toBeCloseTo(275, 0);
    expect(hop('kz')).toBeGreaterThan(395);
  });
});
