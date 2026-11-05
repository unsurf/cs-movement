/**
 * @license
 * @unsurf/cs-movement — Counter-Strike style movement physics
 * Copyright 2026 unsurf
 * SPDX-License-Identifier: Apache-2.0
 */
export const MAX_CLIP_PLANES = 5;
export const NUM_BUMPS = 4; // numbumps: bump up to four times per move
/** Hits that cover less of the move than this count as zero movement (MINIMUM_MOVE_FRACTION). */
export const MINIMUM_MOVE_FRACTION = 0.0001;
/** |normal.y| below this is treated as a perfectly vertical wall (EFFECTIVELY_HORIZONTAL_NORMAL_Z). */
export const EFFECTIVELY_VERTICAL_NORMAL_Y = 0.0001;
