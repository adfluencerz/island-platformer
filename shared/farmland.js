// The home farm's island, as plain numbers: its ground, its platforms and
// where its set pieces stand (src/maps.js draws it; shared/wilds.js places
// its trees and rocks; the merchant's stall and the pens are drawn by
// src/merchant.js and src/animals.js, the neighbours' homes by src/npchomes.js).
//
// The farm began as a square island OLD_HALF tiles out from the middle. It
// is five times that now (HOME_HALF): the old farm is in the middle, as it
// was (its paths, its plaza, its pens, its trees and rocks where they always
// stood), and round it the valley: a forest across the north with a fern glen
// and a bluebell glade in it, a flower meadow to the west where Rosa keeps her
// ranch, a heather heath to the south-west, a lake with a reed marsh to the
// east, Basil's seed cottage by a sunflower field and a pumpkin patch to the
// south-east, a strawberry bank, and shell dunes along the south shore, where
// Finn's hut stands at the head of his dock. Mabel bakes at the forest's edge,
// to the north-east. Roads go out from the old farm's paths to each of them.
import { SPAWN } from './level.js';
import { distToPaths } from './worldgen.js';

export const STALL = { x: 5.5, z: 6.5 }; // the merchant's stall
export const YARD = { x: -9, z: 6, w: 8, d: 6 }; // the hen yard
export const PASTURE = { x: -8.5, z: 15, w: 11, d: 8 }; // the cows' and sheep's pasture
// The pens at each of their levels (PEN_LEVELS in shared/balance.js), the
// first as above: each level the fence goes out a little, away from the
// paths (the yard to the west and north, the pasture to the west and
// south), round the same gate, and clear of where the farm's trees and rocks
// stand (shared/homewilds.js)
const rect = (minX, maxX, minZ, maxZ) => ({ x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ });
export const PEN_RECTS = {
  yard: [YARD, rect(-13.8, -5, 2, 9), rect(-14.5, -5, 1, 9)],
  pasture: [PASTURE, rect(-14.8, -3, 11, 20), rect(-15.5, -3, 11, 21)],
};

export const OLD_HALF = 29; // the farm as it first was
export const HOME_HALF = 70; // and as it is: (2 * 70 + 1)² tiles, 5.7 times the first
// The old farm's paths: from the shore to the plaza, on to the platforms,
// the merchant's stall and the gates of the hen yard and the pasture
export const HOME_PATHS = [
  [[1, 27], [1, 15], [0, 6]], // from the south shore up to spawn
  [[0, 6], [-3, 1], [-6, -1]], // spawn -> first platform
  [[0, 6], [4, 2], [8, -6], [11, -12]], // spawn -> under the high platforms
  [[1, 7], [STALL.x, STALL.z + 2]], // spawn -> the merchant's stall
  [[-2, 5.5], [YARD.x + YARD.w / 2 - 0.5, YARD.z]], // spawn -> the hen yard's gate
  [[1, PASTURE.z], [PASTURE.x + PASTURE.w / 2 - 0.5, PASTURE.z]], // the south path -> the pasture's gate
];
const HOME_PLAZA = { x: 0, z: 5, r: 2.6 };

// ---------- The neighbours' homes ----------
// Each faces south (+z, toward the camera), its door in the middle of its
// front: { x, z } its middle, w by d its footprint. `lot`: how far round it
// is theirs (nothing is built or tilled there, and nothing grows on it).
export const NPC_HOMES = {
  rosa: { x: -50, z: -3, w: 7, d: 5, lot: 10 }, // Meadow Ranch: animals
  basil: { x: 44, z: 22, w: 6, d: 5, lot: 8 }, // Basil's Seeds
  finn: { x: -16, z: 59.5, w: 6, d: 4, lot: 6.5 }, // Finn's Tackle, on the dunes
  mabel: { x: 37, z: -28, w: 6, d: 5, lot: 7.5 }, // Mabel's Bakery
};
// where a home's door is, on its front (and where you stand to go in: a step out from it)
export const npcDoor = (home) => ({ x: home.x, z: home.z + home.d / 2 });
// Inside each home: a room of its own, out past the sea on the farm's world
// (as the farmer's own house's room is: shared/level.js HOUSE_ROOM), where
// nothing else is. Tiles x0..x0+w-1 across, z0..z0+d-1 deep; the door is in
// the middle of the front wall (src/npchomes.js draws them).
export const NPC_ROOMS = {
  rosa: { x0: 400, z0: -125, w: 12, d: 9 },
  basil: { x0: 400, z0: -45, w: 12, d: 9 },
  finn: { x0: 400, z0: 35, w: 12, d: 9 },
  mabel: { x0: 400, z0: 115, w: 12, d: 9 },
};
// Finn's dock: planks from the front of his hut out over the sea
export const DOCK = { x: NPC_HOMES.finn.x, z0: NPC_HOMES.finn.z + NPC_HOMES.finn.d / 2 + 1.5, z1: HOME_HALF + 11, w: 2.2 };

// ---------- The roads and trails ----------
const door = (id, out = 1.6) => { const d = npcDoor(NPC_HOMES[id]); return [d.x, d.z + out]; };
export const ROADS = [
  // west, down the lane between the hen yard and the pasture, over the meadow to the ranch
  [[0.6, 10], [-3, 10], [-16, 10], [-29, 9.5], [-38, 5], [-44, 2], door('rosa')],
  // east, from the south path past the farm's fields to Basil's cottage
  [[1, 15], [5, 14.3], [12, 14.4], [16, 15.3], [29, 15.6], [36, 19], [38, 26.1], door('basil')],
  // south, from the shore the farm had down to Finn's hut on the dunes, and round to his door
  [[1, 27], [1, 38], [-4, 47], [-10, 54], [-11.5, 61], [-13, 63.4], door('finn', 1.3)],
  // north-east, from under the high platforms to Mabel's bakery
  [[11, -12], [12, -10.2], [29, -9.9], [32, -13], [34, -20], door('mabel')],
];
export const TRAILS = [
  [[34, -20], [30, -30], [32, -38], [38, -45], [42, -48]], // into the forest, to the bluebell glade
  [[-38, 5], [-37, -12], [-40, -30], [-44, -45]], // up past the meadow, to the fern glen
  [[1, 36], [14, 39], [28, 43]], // over to the pumpkin patch
];
export const VALLEY_PATHS = [...ROADS, ...TRAILS];
// Every leg of every path, with the box round it a path tile can be in (the
// ground is asked about a great many points, and most are far from any path)
const PATH_W = 0.85;
const LEGS = [...HOME_PATHS, ...VALLEY_PATHS].flatMap((path) => path.slice(1).map((b, i) => {
  const a = path[i];
  return { leg: [[a, b]], minX: Math.min(a[0], b[0]) - PATH_W, maxX: Math.max(a[0], b[0]) + PATH_W, minZ: Math.min(a[1], b[1]) - PATH_W, maxZ: Math.max(a[1], b[1]) + PATH_W };
}));
const onPath = (x, z) => LEGS.some((l) => x > l.minX && x < l.maxX && z > l.minZ && z < l.maxZ && distToPaths(x, z, l.leg) < PATH_W);

// Signposts where the roads leave the old farm, pointing the way (dir: the
// way the arrow points on the screen, 'left', 'right', 'down' or 'up')
export const SIGNPOSTS = [
  { x: -31, z: 11.8, text: 'Meadow Ranch', dir: 'left' },
  { x: 31, z: 13.6, text: 'Basil\'s Seeds', dir: 'right' },
  { x: 3.2, z: 31, text: 'Finn\'s Tackle', dir: 'down' },
  { x: 30.6, z: -7.8, text: 'Mabel\'s Bakery', dir: 'up' },
];

// ---------- The biomes ----------
// A smooth wobble, -1 to 1, for edges that aren't circles
const wob = (x, z, s) => Math.sin(x * 0.21 + s * 1.7) * Math.cos(z * 0.17 + s * 2.9) * 0.6 + Math.sin((x + z) * 0.09 + s * 4.1) * 0.4;
const blob = (x, z, r, s) => ({ x, z, r, s });
function inBlob(gx, gz, b, k = 0.16) {
  const d = Math.hypot(gx - b.x, gz - b.z);
  if (d >= b.r * (1 + k)) return false; // (the wobble is -1 to 1: no need to work it out out here...)
  return d < b.r * (1 - k) || d < b.r * (1 + k * wob(gx, gz, b.s)); // (...or in there)
}
export const LAKE = { x: 53, z: -7, r: 7.5, s: 7 };
const MARSH = blob(LAKE.x, LAKE.z, 12, 8);
export const BIOMES = {
  glen: blob(-46, -54, 10, 1), // ferns, deep in the forest
  glade: blob(44, -53, 10, 2), // bluebells
  meadow: blob(-50, 0, 15, 3), // flowers, round the ranch
  heath: blob(-47, 40, 16, 4), // heather
  field: blob(57, 36, 9, 5), // sunflowers
  patch: blob(34, 45, 6.5, 6), // pumpkins
  bank: blob(17, 52, 5.5, 9), // strawberries
};
// the old farm, in the middle: grass, as it was (with its own paths)
const inOldFarm = (gx, gz) => Math.max(Math.abs(gx), Math.abs(gz)) <= OLD_HALF;
// how wide the beach is here: wider along the south, where the dunes are
const beachAt = (gx, gz) => 1.5 + 1.1 * (wob(gx, gz, 11) + 1) + (gz > Math.abs(gx) ? 1.5 : 0);
const forestEdge = (gx) => -36 + 4 * wob(gx * 0.7, 3, 12);
const dunesEdge = (gx) => HOME_HALF - 12 + 2.5 * wob(gx, 1, 13);
export const inLake = (x, z) => inBlob(Math.round(x), Math.round(z), LAKE, 0.12);

// What the ground is at tile (gx, gz): 'sand', 'stone', 'path', 'grass',
// the lake ('pond'), or one of the biomes ('moss' is the forest)
export function homeGround(gx, gz) {
  const edge = Math.max(Math.abs(gx), Math.abs(gz));
  if (edge > HOME_HALF - beachAt(gx, gz)) return 'sand';
  if (Math.hypot(gx - HOME_PLAZA.x, gz - HOME_PLAZA.z) < HOME_PLAZA.r) return 'stone';
  if (onPath(gx, gz)) return 'path';
  if (inOldFarm(gx, gz)) return 'grass';
  if (inBlob(gx, gz, LAKE, 0.12)) return 'pond';
  if (inBlob(gx, gz, MARSH, 0.22)) return 'marsh';
  for (const [kind, b] of Object.entries(BIOMES)) if (inBlob(gx, gz, b)) return kind;
  if (gz < forestEdge(gx)) return 'moss';
  if (gz > dunesEdge(gx)) return 'dune';
  return 'grass';
}
// (the lake's floor: you wade in, as in a lobby's pond)
export const HOME_FLOORS = { pond: -0.45 };

// The farm as it first was: a square island with a sand rim, its old paths
// and plaza, grass everywhere else. Its trees and rocks were placed on this,
// and still stand where they were placed (shared/wilds.js).
export function oldHomeGround(gx, gz) {
  if (Math.max(Math.abs(gx), Math.abs(gz)) > OLD_HALF - 1.5) return 'sand';
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

// [x, z, r]: nothing grows here (the spawn, the stall, the pens) on the old farm...
export const OLD_KEEP_CLEAR = [
  [SPAWN.x, SPAWN.z, 1.5], [STALL.x, STALL.z + 1.5, 4], [YARD.x, YARD.z, Math.hypot(YARD.w, YARD.d) / 2 + 0.6],
  [PASTURE.x, PASTURE.z, Math.hypot(PASTURE.w, PASTURE.d) / 2 + 0.6],
];
// ...and on the valley round it: the neighbours' homes, and Finn's dock
export const HOME_KEEP_CLEAR = [
  ...OLD_KEEP_CLEAR,
  ...Object.values(NPC_HOMES).map((h) => [h.x, h.z + 0.5, h.lot]),
  [DOCK.x, DOCK.z0, 2.5],
  ...SIGNPOSTS.map(({ x, z }) => [x, z, 1.2]),
];

// Why tile (gx, gz) is not to be farmed or built on ('': it may be): the
// lake, someone's home, Finn's dock. (The edge, the pens and the rest are
// the page's and the farm room's own checks.)
export function farmBlocked(gx, gz) {
  if (homeGround(gx, gz) === 'pond') return 'lake';
  for (const h of Object.values(NPC_HOMES)) if (Math.hypot(gx - h.x, gz - (h.z + 0.5)) < h.lot) return 'home';
  if (Math.abs(gx - DOCK.x) < DOCK.w && gz > DOCK.z0 - 3) return 'home';
  return '';
}
