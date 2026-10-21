// The parts of the world the server has to know about too: what the resource
// spots can turn up, where players are put down, and how long crops take. The
// wild islands the lobbies are on (their shape, and where their spots are)
// grow from seeds in shared/worldgen.js. What the worlds look like is the
// client's business (src/maps.js, src/world.js). The numbers that balance
// the game (times, costs, what things give) are in shared/balance.js.
import { CROP_GROW_TIME, LOBBY_SPOTS, TREE_BALANCE, ROCK_BALANCE, BUILD_COSTS, CHEST, SKY_CHESTS } from './balance.js';
import { SKY_STYLES, relicAt } from './skyisles.js';
export { CROP_GROW_TIME, WEAPONS, BOP_GRACE, SAFE_CIRCLE, DROP_MS, CHEST, GIANT, STURDY_HITS } from './balance.js';

export const GROUND_STAND_Y = 0.8; // player center height standing on bare ground (height 1.6 / 2)
export const SPAWN = { x: 0, z: 4 }; // the middle of the home farm's stone plaza
export const FARM_CHEST = { x: -2.8, z: 7.4 }; // where the farm's chest stands on a farm with helpers till one is built (src/chest.js): on the grass by the plaza

// Is there room in a chest's items ({ item: count }) for count more of item?
export function chestHasRoom(items, item, count) {
  const have = items[item] ?? 0;
  return have + count <= CHEST.stack && (have > 0 || Object.keys(items).length < CHEST.kinds);
}

// (Seconds from planting to ripe: CROP_GROW_TIME, shared/balance.js; src/crops.js draws them)
// what a ripe crop gives when it is harvested (on a farm with helpers the
// server hands it out, into the farm's chest)
export const CROP_PRODUCE = { turnip: 'turnip', carrot: 'carrot', flax: 'flax', sunflower: 'sunflower', golden_turnip: 'golden_turnip' };

// ---------- Lobby resources ----------
// What can stand on a spot (each island says where its spots are). `use`: 'gather' is picked with E from nearby,
// 'touch' is collected by walking into it. `regrow`: seconds [min, max] until
// an emptied spot has something again. `loot`: [item, weight, min, max]; one
// is rolled each time the spot regrows, so a spot is a little different every
// time.
// (regrow and loot: LOBBY_SPOTS, shared/balance.js)
const TOUCHED = new Set(['meadow', 'ledge', 'sky', 'relic']); // (the rest are gathered)
export const SPOT_KINDS = Object.fromEntries(Object.entries(LOBBY_SPOTS).map(([kind, spot]) => [kind, { use: TOUCHED.has(kind) ? 'touch' : 'gather', ...spot }]));

// ---------- Trees ----------
// Every tree on a wild island can be chopped down for wood. Where the trees
// stand is the page's business (src/maps.js grows them from the seed, the same
// for everyone); the lobby only keeps which ones are down, by their number.
// `hits`: swings with the axe to fell one. `regrow`: seconds [min, max] until
// it stands again. `wood`: [min, max] logs for whoever felled it, from a tree
// of size 1; bigger trees give more (`size`: the smallest and biggest there are,
// so a page can't claim a giant).
export const TREE = { ...TREE_BALANCE, size: [0.8, 1.6] }; // (hits, regrow, wood: shared/balance.js)

const treeSize = (size) => Math.min(TREE.size[1], Math.max(TREE.size[0], Number.isFinite(size) ? size : 1));

// Logs from felling a tree of this size. rand: () => [0, 1)
export function woodFor(size, rand = Math.random) {
  const [lo, hi] = TREE.wood;
  return Math.max(1, Math.round((lo + Math.floor(rand() * (hi - lo + 1))) * treeSize(size)));
}

// The most a tree of this size can give (room to keep in the backpack)
export const mostWood = (size) => Math.round(TREE.wood[1] * treeSize(size));

// ---------- Rocks ----------
// Every rock on a wild island can be broken up for stone with the pickaxe,
// the way trees are felled: the page knows where they lie (src/maps.js), the
// lobby keeps which are broken, by their number. `hits`: swings to break one.
// `regrow`: seconds [min, max] until a new one has surfaced. `stone`: [min,
// max] for a rock of size `per` (a fist-sized one); smaller ones still give
// one, the big boulders by the terraces give the most (`size`: the smallest
// and biggest rocks there are, so a page can't claim a mountain).
export const ROCK = { ...ROCK_BALANCE, size: [0.15, 1.1] }; // (hits, regrow, stone, per: shared/balance.js)

// ---------- Growing back elsewhere ----------
// A felled tree or a broken rock grows back in another of its few places
// (src/world.js has where they are, the same on every page). A lobby or farm
// keeps the count of how often each grew back, going round at SITE_ROUND (a
// number any count of places up to four goes into); a tree or rock not in its
// list is in its first place.
export const SITE_ROUND = 12;
export const nextSite = (n = 0) => (n + 1) % SITE_ROUND;

// A saved or sent list of [[id, count]] as a Map, keeping only sensible entries (ids below most)
export function siteMap(list, most) {
  return new Map((Array.isArray(list) ? list : []).filter((entry) => Array.isArray(entry) &&
    Number.isInteger(entry[0]) && entry[0] >= 0 && entry[0] < most && Number.isInteger(entry[1]) && entry[1] > 0 && entry[1] < SITE_ROUND));
}

const rockSize = (size) => Math.min(ROCK.size[1], Math.max(ROCK.size[0], Number.isFinite(size) ? size : ROCK.per));

// Stone from breaking a rock of this size. rand: () => [0, 1)
export function stoneFor(size, rand = Math.random) {
  const [lo, hi] = ROCK.stone;
  return Math.max(1, Math.round(((lo + Math.floor(rand() * (hi - lo + 1))) * rockSize(size)) / ROCK.per));
}

// The most a rock of this size can give (room to keep in the backpack)
export const mostStone = (size) => Math.max(1, Math.round((ROCK.stone[1] * rockSize(size)) / ROCK.per));

// ---------- Building ----------
// What can be built on a farm in build mode (src/build.js draws them): one
// piece to a tile. `solid` ones are in the way (fences and walls join up with
// the fences and walls beside them); paths are walked on. `cost` comes out of
// the backpack, and goes back in when the piece is taken down: wood and
// stone, or for the decorations, one made at the workbench (src/workbench.js);
// what each costs is BUILD_COSTS in shared/balance.js.
// Blocks (`block`: its height) are solid boxes a farmer can stand on: a step
// is walked up onto, anything taller takes a jump. They come in heights a
// step apart (0.45, 0.9, 1.35, 1.8; a log pile and a stone block are a little
// taller than a crate), so step, crate, scaffold, pillar is a stair walked all
// the way up. A gate `joins` the fences beside it like a fence, but is walked
// through, and a stone arch or a wood arbor joins the walls (or fences)
// beside it the same way. A low stone wall, a rail, picket or wattle fence or
// a box hedge is hopped over like a fence; a palisade, like a stone wall, can't be. A farm has `one`
// farm chest at most (src/chest.js): built, it stands where it was put; on a
// farm with helpers there is one by the plaza till then, so the harvest
// always has somewhere to go.
// A farm with helpers keeps its pieces in its room (server/farmroom.js), like its soil.
export const PIECES = {
  wood_fence: { name: 'Wood fence', solid: true, joins: true },
  stone_wall: { name: 'Stone wall', solid: true, joins: true },
  wood_path: { name: 'Wood path' },
  stone_path: { name: 'Stone path' },
  wood_gate: { name: 'Wood gate', joins: true },
  wood_crate: { name: 'Wood crate', solid: true, block: 0.9 },
  stone_step: { name: 'Stone step', solid: true, block: 0.45 },
  stone_block: { name: 'Stone block', solid: true, block: 1 },
  wood_step: { name: 'Wood step', solid: true, block: 0.45 },
  log_pile: { name: 'Log pile', solid: true, block: 1 },
  wood_scaffold: { name: 'Wood scaffold', solid: true, block: 1.35 },
  tall_stone_block: { name: 'Tall stone block', solid: true, block: 1.35 },
  stone_pillar: { name: 'Stone pillar', solid: true, block: 1.8 },
  low_stone_wall: { name: 'Low stone wall', solid: true, joins: true },
  wood_palisade: { name: 'Wood palisade', solid: true, joins: true },
  wood_barrel: { name: 'Wood barrel', solid: true, block: 1 },
  straw_step: { name: 'Straw step', solid: true, block: 0.45 },
  straw_bale: { name: 'Straw bale', solid: true, block: 0.9 },
  straw_stack: { name: 'Straw stack', solid: true, block: 1.35 },
  log_tower: { name: 'Log tower', solid: true, block: 1.8 },
  stone_arch: { name: 'Stone arch', joins: true },
  cobble_path: { name: 'Cobble path' },
  rail_fence: { name: 'Rail fence', solid: true, joins: true },
  wood_arbor: { name: 'Wood arbor', joins: true },
  gravel_path: { name: 'Gravel path' },
  mossy_stone_block: { name: 'Mossy stone block', solid: true, block: 1 },
  stone_well: { name: 'Stone well', solid: true },
  box_hedge: { name: 'Box hedge', solid: true, joins: true },
  stepping_stones: { name: 'Stepping stones' },
  tree_stump: { name: 'Tree stump', solid: true, block: 0.45 },
  crate_stack: { name: 'Crate stack', solid: true, block: 1.35 },
  stone_lantern: { name: 'Stone lantern', solid: true },
  scarecrow: { name: 'Scarecrow', solid: true },
  picket_fence: { name: 'Picket fence', solid: true, joins: true },
  grain_sacks: { name: 'Grain sacks', solid: true, block: 0.9 },
  hay_cart: { name: 'Hay cart', solid: true },
  beehive: { name: 'Beehive', solid: true },
  birdbath: { name: 'Birdbath', solid: true },
  signpost: { name: 'Signpost', solid: true },
  wattle_fence: { name: 'Wattle fence', solid: true, joins: true },
  water_trough: { name: 'Water trough', solid: true },
  stone_bench: { name: 'Stone bench', solid: true },
  sundial: { name: 'Sundial', solid: true },
  wheelbarrow: { name: 'Wheelbarrow', solid: true },
  barrel_stack: { name: 'Barrel stack', solid: true, block: 1.8 },
  torch: { name: 'Torch', solid: true },
  workbench: { name: 'Workbench', solid: true },
  farm_chest: { name: 'Farm chest', solid: true, one: true },
  house: { name: 'House', solid: true, perHelper: true, size: [5, 4] }, // (one, and one more for each helper: mostPieces)
  lamp_post: { name: 'Lamp post', solid: true },
  garden_bench: { name: 'Garden bench', solid: true },
  planter: { name: 'Flower planter', solid: true },
};
for (const [id, piece] of Object.entries(PIECES)) piece.cost = BUILD_COSTS[id] ?? {}; // (shared/balance.js)
export const MAX_PIECES = 2000; // on one farm
// How many of piece id a farm may have, with this many helpers: one of the
// `one` pieces, one more house for each helper, as many as it likes of the rest
export const mostPieces = (id, helpers) => (PIECES[id].one ? 1 : PIECES[id].perHelper ? 1 + helpers : Infinity);

// The tiles a piece built on tile key stands on: one, or for a piece with a
// `size` [across, deep] (the house), that many, its front row centred on key
// and the rest behind it (toward -z, away from the camera)
export function pieceTiles(piece, key) {
  const size = PIECES[piece]?.size;
  if (!size) return [key];
  const [gx, gz] = key.split(',').map(Number);
  const [w, d] = size;
  const left = gx - Math.floor(w / 2);
  const tiles = [];
  for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) tiles.push(`${left + dx},${gz - dz}`);
  return tiles;
}

// ---------- Inside the house ----------
// The house's door (in the middle of its front, on the tile it was built on)
// leads inside: a room of its own, out past the sea where nothing else is, so
// its tiles have keys of their own (the farm's are within 28 of the middle).
// Its field is farmed like the farm's, on a farm with helpers too; the rest
// of the floor is boards. One house to a farm, so one room.
export const HOUSE_ROOM = { x0: 110, z0: -5, w: 20, d: 10 }; // tiles x0..x0+w-1 across, z0..z0+d-1 deep: 200
export const HOUSE_FIELD = { x0: 111, z0: -4, w: 8, d: 6 }; // the indoor field, in the room's left half
export const HOUSE_DOOR_IN = { x: 119.5, z: 4.5 }; // the room's door, in the middle of its front wall

const inArea = (a, x, z) => x > a.x0 - 0.5 && x < a.x0 + a.w - 0.5 && z > a.z0 - 0.5 && z < a.z0 + a.d - 0.5;
// Is x, z (world units, a tile's middle or anywhere) in the house's room, or its field?
export const inHouseRoom = (x, z) => inArea(HOUSE_ROOM, x, z);
export const inHouseField = (x, z) => inArea(HOUSE_FIELD, x, z);

// Tiles kept clear of building: where farmers arrive, and the farm's chest
export function keptClear(gx, gz) {
  return Math.hypot(gx - SPAWN.x, gz - SPAWN.z) < 1.6 || Math.hypot(gx - FARM_CHEST.x, gz - FARM_CHEST.z) < 1.1;
}

// ---------- Bopping (lobbies) ----------
// Made at the workbench (src/workbench.js): with one in hand, E in a lobby
// swings it, and the farmer in front of you, within `reach`, gets bopped:
// knocked back (at `knock`), and they drop up to `drops` of something they
// gathered on this visit, for anyone to pick up (never a rare find, nor
// gold). Nobody gets hurt. `every`: ms between swings that count. A farmer
// who was just bopped can't be again for BOP_GRACE ms, and the stone circle
// where farmers arrive (within SAFE_CIRCLE of it) is for resting.
// (WEAPONS, BOP_GRACE, SAFE_CIRCLE and DROP_MS: shared/balance.js)

// Finds rare enough that the whole lobby hears when one turns up
export const RARE = {
  golden_seeds: 'Golden seeds',
  key: 'An old key',
  ...Object.fromEntries(SKY_STYLES.map(({ relic, found }) => [relic, found])), // (the sky isles' relics)
};

// Roll a spot's loot: [item, count]. rand: () => [0, 1)
export const rollLoot = (kind, rand = Math.random) => pick(SPOT_KINDS[kind].loot, rand);

// What a lobby's spot starts out with: { item, count }, and for a chest up on
// a sky isle its `bundle` ([[item, count], ...]; its item is 'chest'). A relic
// is the one its isle's style has. island: islandFor(seed). rand: () => [0, 1)
export function rollSpot(island, kind, x, z, rand = Math.random) {
  if (kind === 'relic') return { item: relicAt(island, x, z), count: 1 };
  if (SKY_CHESTS[kind]) return { item: 'chest', count: 1, bundle: rollChest(kind, rand) };
  const [item, count] = rollLoot(kind, rand);
  return { item, count };
}

// What is in a chest of this kind (SKY_CHESTS): [[item, count], ...]
export function rollChest(kind, rand = Math.random) {
  const { rolls: [lo, hi], loot } = SKY_CHESTS[kind];
  const got = new Map();
  for (let n = lo + Math.floor(rand() * (hi - lo + 1)); n > 0; n--) {
    const [item, count] = pick(loot, rand);
    got.set(item, (got.get(item) ?? 0) + count);
  }
  return [...got];
}

// One of loot ([item, weight, min, max], ...) by weight: [item, count]
function pick(loot, rand) {
  let r = rand() * loot.reduce((sum, [, w]) => sum + w, 0);
  for (const [item, w, min, max] of loot) {
    r -= w;
    if (r < 0) return [item, min + Math.floor(rand() * (max - min + 1))];
  }
  const [item, , min] = loot[loot.length - 1];
  return [item, min];
}

// Where player i of n arrives around center: a ring, so people arriving don't
// land inside each other.
export function spawnPoint(center, i, n) {
  if (n <= 1) return { x: center.x, y: GROUND_STAND_Y, z: center.z };
  const a = (i / n) * Math.PI * 2;
  const r = Math.min(1.2 + n * 0.15, 2.2);
  return { x: center.x + Math.cos(a) * r, y: GROUND_STAND_Y, z: center.z + Math.sin(a) * r };
}
