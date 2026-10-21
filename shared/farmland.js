// The home farm's island, as plain numbers: its ground, its platforms and
// where its set pieces stand (src/maps.js draws it; shared/wilds.js places
// its trees and rocks; the merchant's stall and the pens are drawn by
// src/merchant.js and src/animals.js).
import { SPAWN } from './level.js';
import { distToPaths } from './worldgen.js';

export const STALL = { x: 5.5, z: 6.5 }; // the merchant's stall
export const YARD = { x: -9, z: 6, w: 8, d: 6 }; // the hen yard
export const PASTURE = { x: -8.5, z: 15, w: 11, d: 8 }; // the cows' and sheep's pasture

export const HOME_HALF = 29;
// A square island: a sand rim, a stone plaza at spawn, dirt paths toward a
// staggered set of platforms, the merchant's stall and the gates of the hen
// yard and the pasture, and grass everywhere else.
export const HOME_PATHS = [
  [[1, 27], [1, 15], [0, 6]], // from the south shore up to spawn
  [[0, 6], [-3, 1], [-6, -1]], // spawn -> first platform
  [[0, 6], [4, 2], [8, -6], [11, -12]], // spawn -> under the high platforms
  [[1, 7], [STALL.x, STALL.z + 2]], // spawn -> the merchant's stall
  [[-2, 5.5], [YARD.x + YARD.w / 2 - 0.5, YARD.z]], // spawn -> the hen yard's gate
  [[1, PASTURE.z], [PASTURE.x + PASTURE.w / 2 - 0.5, PASTURE.z]], // the south path -> the pasture's gate
];
const HOME_PLAZA = { x: 0, z: 5, r: 2.6 };

// What the ground is at tile (gx, gz): 'sand', 'stone', 'path' or 'grass'
export function homeGround(gx, gz) {
  if (Math.max(Math.abs(gx), Math.abs(gz)) > HOME_HALF - 1.5) return 'sand';
  if (Math.hypot(gx - HOME_PLAZA.x, gz - HOME_PLAZA.z) < HOME_PLAZA.r) return 'stone';
  if (distToPaths(gx, gz, HOME_PATHS) < 0.85) return 'path';
  return 'grass';
}

// Trees stay out of the platforming area so they never block a jump or the view
const PLAY_AREA = { minX: -14, maxX: 17, minZ: -21, maxZ: 9 };
export const inPlayArea = (x, z) =>
  x > PLAY_AREA.minX && x < PLAY_AREA.maxX && z > PLAY_AREA.minZ && z < PLAY_AREA.maxZ;

const platform = (x, y, z, w, h, d, color = 0x8b5a2b) => ({ x, y, z, w, h, d, color, cap: 'grass' });
export const HOME_PLATFORMS = [
  platform(-6, 1, -4, 4, 1, 4),
  platform(0, 2.5, -8, 4, 1, 4),
  platform(6, 4, -12, 4, 1, 4),
  platform(12, 5.5, -16, 4, 1, 4),
  platform(-10, 3, -14, 3, 1, 3, 0xa0522d),
];

// [x, z, r]: nothing grows here (the spawn, the stall, the pens)
export const HOME_KEEP_CLEAR = [
  [SPAWN.x, SPAWN.z, 1.5], [STALL.x, STALL.z + 1.5, 4], [YARD.x, YARD.z, Math.hypot(YARD.w, YARD.d) / 2 + 0.6],
  [PASTURE.x, PASTURE.z, Math.hypot(PASTURE.w, PASTURE.d) / 2 + 0.6],
];
