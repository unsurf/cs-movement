/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
import { DEFAULT_PERF_SETTINGS } from '../../physics/PerfBonus/PerfBonus.config.js';
import { DEFAULT_PHYSICS_SETTINGS } from '../../physics/PhysicsSettings/PhysicsSettings.config.js';
import { DEFAULT_STAMINA_SETTINGS } from '../../physics/Stamina/Stamina.config.js';
import type { Preset } from './Presets.types.js';

export const PRESET_NAMES = ['vanilla', 'hnsNopre', 'hnsPre', 'kz', 'kzTimer', 'surf', 'bhop'] as const;

const STAMINA_OFF = { ...DEFAULT_STAMINA_SETTINGS, enabled: false };
const STAMINA_ON = { ...DEFAULT_STAMINA_SETTINGS, enabled: true };
const PERF_OFF = { ...DEFAULT_PERF_SETTINGS, enabled: false };

/**
 * Known server setups. `vanilla`, `kz` and `kzTimer` are copied straight from
 * GOKZ's mode plugins (gokz-mode-vanilla/simplekz/kztimer.sp), which pin every
 * movement cvar. `surf` and `bhop` are community conventions (surf guides
 * agree on airaccelerate 150, accelerate 10, maxvelocity 3500). The HNS
 * presets are the least certain: HNS servers are plugin-driven and no
 * authoritative cvar list exists, so they follow this library's own
 * calibration (see PerfBonus) plus the only published chasemod config found.
 */
export const PRESETS: Record<(typeof PRESET_NAMES)[number], Preset> = {
  vanilla: {
    label: 'Vanilla CS:GO',
    source: 'GOKZ gokz-mode-vanilla.sp; stock movevars. Stamina on, no bunnyhopping, no autobhop.',
    settings: {
      autobhop: false,
      bhopSpeedClamp: true,
      noPrestrafe: true,
      airAccelerate: 12,
      stamina: STAMINA_ON,
      perf: PERF_OFF,
      physics: { ...DEFAULT_PHYSICS_SETTINGS },
    },
  },
  hnsNopre: {
    label: 'HNS (nopre)',
    source:
      'Library calibration: sv_enablebunnyhopping 0 (takeoff clamp), ground clamp on, ' +
      'air-speed ceiling ~390 (observed on nopre chasemod). Unverified against a live server.',
    settings: {
      autobhop: false,
      bhopSpeedClamp: true,
      noPrestrafe: true,
      airAccelerate: 100,
      stamina: STAMINA_OFF,
      perf: { ...DEFAULT_PERF_SETTINGS, enabled: true },
      physics: { ...DEFAULT_PHYSICS_SETTINGS, accelerate: 6.5 },
    },
  },
  hnsPre: {
    label: 'HNS (pre)',
    source:
      'As hnsNopre but the always-on ground speed clamp is lifted, so ground prestrafe carries. ' +
      'Unverified against a live server.',
    settings: {
      autobhop: false,
      bhopSpeedClamp: true,
      noPrestrafe: false,
      airAccelerate: 100,
      stamina: STAMINA_OFF,
      perf: PERF_OFF,
      physics: { ...DEFAULT_PHYSICS_SETTINGS, accelerate: 6.5 },
    },
  },
  kz: {
    label: 'KZ (SimpleKZ)',
    source: 'GOKZ gokz-mode-simplekz.sp. Bunnyhopping on, stamina off, ladders at full speed.',
    settings: {
      autobhop: false,
      bhopSpeedClamp: false,
      noPrestrafe: true,
      airAccelerate: 100,
      stamina: STAMINA_OFF,
      perf: PERF_OFF,
      physics: { ...DEFAULT_PHYSICS_SETTINGS, accelerate: 6.5, ladderScaleSpeed: 1, timeBetweenDucks: 0 },
    },
  },
  kzTimer: {
    label: 'KZ (KZTimer)',
    source: 'GOKZ gokz-mode-kztimer.sp: friction 5.0, maxvelocity 2000.',
    settings: {
      autobhop: false,
      bhopSpeedClamp: false,
      noPrestrafe: true,
      airAccelerate: 100,
      stamina: STAMINA_OFF,
      perf: PERF_OFF,
      physics: {
        ...DEFAULT_PHYSICS_SETTINGS,
        accelerate: 6.5,
        friction: 5,
        maxVelocity: 2000,
        ladderScaleSpeed: 1,
        timeBetweenDucks: 0,
      },
    },
  },
  surf: {
    label: 'Surf (skill)',
    source: 'Community surf guides: airaccelerate 150, accelerate 10, maxvelocity 3500, stamina costs 0.',
    settings: {
      autobhop: false,
      bhopSpeedClamp: false,
      noPrestrafe: true,
      airAccelerate: 150,
      stamina: STAMINA_OFF,
      perf: PERF_OFF,
      physics: { ...DEFAULT_PHYSICS_SETTINGS, accelerate: 10 },
    },
  },
  bhop: {
    label: 'Bhop (auto)',
    source:
      'Community bhop-server convention: bunnyhopping + autobunnyhopping on, stamina off, ' +
      'airaccelerate 1000 ("very easy" tier; 100 is the hard tier), accelerate 10.',
    settings: {
      autobhop: true,
      bhopSpeedClamp: false,
      noPrestrafe: true,
      airAccelerate: 1000,
      stamina: STAMINA_OFF,
      perf: PERF_OFF,
      physics: { ...DEFAULT_PHYSICS_SETTINGS, accelerate: 10 },
    },
  },
};
