// The parts of the world the server has to know about too: what the resource
// spots can turn up, where players are put down, and how long crops take. The
// wild islands the lobbies are on (their shape, and where their spots are)
// grow from seeds in shared/worldgen.js. What the worlds look like is the
// client's business (src/maps.js, src/world.js).

export const GROUND_STAND_Y = 0.8; // player center height standing on bare ground (height 1.6 / 2)
export const SPAWN = { x: 0, z: 4 }; // the middle of the home farm's stone plaza
export const FARM_CHEST = { x: -2.8, z: 7.4 }; // where the farm's chest stands on a farm with helpers till one is built (src/chest.js): on the grass by the plaza
export const CHEST = { stack: 999, kinds: 64 }; // the most of one item in the chest, and of different items

// Is there room in a chest's items ({ item: count }) for count more of item?
export function chestHasRoom(items, item, count) {
  const have = items[item] ?? 0;
  return have + count <= CHEST.stack && (have > 0 || Object.keys(items).length < CHEST.kinds);
}

// Seconds from planting to ripe (src/crops.js draws them)
export const CROP_GROW_TIME = { turnip: 20, carrot: 30, flax: 35, sunflower: 45, golden_turnip: 60 };
// what a ripe crop gives when it is harvested (on a farm with helpers the
// server hands it out, into the farm's chest)
export const CROP_PRODUCE = { turnip: 'turnip', carrot: 'carrot', flax: 'flax', sunflower: 'sunflower', golden_turnip: 'golden_turnip' };

// ---------- Lobby resources ----------
// What can stand on a spot (each island says where its spots are). `use`: 'gather' is picked with E from nearby,
// 'touch' is collected by walking into it. `regrow`: seconds [min, max] until
// an emptied spot has something again. `loot`: [item, weight, min, max]; one
// is rolled each time the spot regrows, so a spot is a little different every
// time.
export const SPOT_KINDS = {
  bush: { use: 'gather', regrow: [35, 50], loot: [['berries', 1, 2, 3]] },
  mushroom: {
    use: 'gather',
    regrow: [25, 40],
    loot: [['mushroom', 0.95, 1, 2], ['golden_seeds', 0.05, 1, 1]],
  },
  heather: { use: 'gather', regrow: [30, 45], loot: [['heather', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (the heath, generation 2 islands)
  cattail: { use: 'gather', regrow: [30, 45], loot: [['cattail', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (the marsh, generation 4 islands)
  bluebell: { use: 'gather', regrow: [30, 45], loot: [['bluebell', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (the glade, generation 5 islands)
  meadow: {
    use: 'touch',
    regrow: [30, 50],
    loot: [['coin', 0.72, 1, 1], ['turnip_seeds', 0.22, 2, 4], ['flax_seeds', 0.18, 1, 2], ['golden_seeds', 0.04, 1, 1], ['key', 0.02, 1, 1]],
  },
  ledge: {
    use: 'touch',
    regrow: [40, 60],
    loot: [['gem', 0.45, 1, 1], ['carrot_seeds', 0.25, 2, 4], ['sunflower_seeds', 0.2, 1, 3], ['flax_seeds', 0.18, 1, 2], ['golden_seeds', 0.06, 1, 1], ['key', 0.04, 1, 1]],
  },
};

// ---------- Trees ----------
// Every tree on a wild island can be chopped down for wood. Where the trees
// stand is the page's business (src/maps.js grows them from the seed, the same
// for everyone); the lobby only keeps which ones are down, by their number.
// `hits`: swings with the axe to fell one. `regrow`: seconds [min, max] until
// it stands again. `wood`: [min, max] logs for whoever felled it, from a tree
// of size 1; bigger trees give more (`size`: the smallest and biggest there are,
// so a page can't claim a giant).
export const TREE = { hits: 4, regrow: [60, 120], wood: [2, 4], size: [0.8, 1.6] };

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
export const ROCK = { hits: 3, regrow: [90, 150], stone: [1, 2], per: 0.4, size: [0.15, 1.1] };

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
// stone, or for the decorations, one made at the workbench (src/workbench.js).
// Blocks (`block`: its height) are solid boxes a farmer can stand on: a step
// is walked up onto, anything taller takes a jump. They come in heights a
// step apart (0.45, 0.9, 1.35, 1.8; a log pile and a stone block are a little
// taller than a crate), so step, crate, scaffold, pillar is a stair walked all
// the way up. A gate `joins` the fences beside it like a fence, but is walked
// through, and a stone arch or a wood arbor joins the walls (or fences)
// beside it the same way. A low stone wall or a rail fence is hopped over
// like a fence; a palisade, like a stone wall, can't be. A farm has `one`
// farm chest at most (src/chest.js): built, it stands where it was put; on a
// farm with helpers there is one by the plaza till then, so the harvest
// always has somewhere to go.
// A farm with helpers keeps its pieces in its room (server/farmroom.js), like its soil.
export const PIECES = {
  wood_fence: { name: 'Wood fence', cost: { wood: 2 }, solid: true, joins: true },
  stone_wall: { name: 'Stone wall', cost: { stone: 3 }, solid: true, joins: true },
  wood_path: { name: 'Wood path', cost: { wood: 1 } },
  stone_path: { name: 'Stone path', cost: { stone: 1 } },
  wood_gate: { name: 'Wood gate', cost: { wood: 3 }, joins: true },
  wood_crate: { name: 'Wood crate', cost: { wood: 3 }, solid: true, block: 0.9 },
  stone_step: { name: 'Stone step', cost: { stone: 2 }, solid: true, block: 0.45 },
  stone_block: { name: 'Stone block', cost: { stone: 4 }, solid: true, block: 1 },
  wood_step: { name: 'Wood step', cost: { wood: 2 }, solid: true, block: 0.45 },
  log_pile: { name: 'Log pile', cost: { wood: 4 }, solid: true, block: 1 },
  wood_scaffold: { name: 'Wood scaffold', cost: { wood: 5 }, solid: true, block: 1.35 },
  tall_stone_block: { name: 'Tall stone block', cost: { stone: 6 }, solid: true, block: 1.35 },
  stone_pillar: { name: 'Stone pillar', cost: { stone: 8 }, solid: true, block: 1.8 },
  low_stone_wall: { name: 'Low stone wall', cost: { stone: 2 }, solid: true, joins: true },
  wood_palisade: { name: 'Wood palisade', cost: { wood: 4 }, solid: true, joins: true },
  wood_barrel: { name: 'Wood barrel', cost: { wood: 4 }, solid: true, block: 1 },
  straw_bale: { name: 'Straw bale', cost: { flax: 3 }, solid: true, block: 0.9 },
  straw_stack: { name: 'Straw stack', cost: { flax: 6 }, solid: true, block: 1.35 },
  log_tower: { name: 'Log tower', cost: { wood: 8 }, solid: true, block: 1.8 },
  stone_arch: { name: 'Stone arch', cost: { stone: 5 }, joins: true },
  cobble_path: { name: 'Cobble path', cost: { stone: 2 } },
  rail_fence: { name: 'Rail fence', cost: { wood: 3 }, solid: true, joins: true },
  wood_arbor: { name: 'Wood arbor', cost: { wood: 5 }, joins: true },
  gravel_path: { name: 'Gravel path', cost: { stone: 1 } },
  mossy_stone_block: { name: 'Mossy stone block', cost: { stone: 4 }, solid: true, block: 1 },
  stone_well: { name: 'Stone well', cost: { stone: 6, wood: 3 }, solid: true },
  workbench: { name: 'Workbench', cost: { wood: 10, stone: 5 }, solid: true },
  farm_chest: { name: 'Farm chest', cost: { wood: 8, stone: 2 }, solid: true, one: true },
  house: { name: 'House', cost: { wood: 500, stone: 200 }, solid: true, one: true, size: [5, 4] },
  lamp_post: { name: 'Lamp post', cost: { lamp_post: 1 }, solid: true },
  garden_bench: { name: 'Garden bench', cost: { garden_bench: 1 }, solid: true },
  planter: { name: 'Flower planter', cost: { planter: 1 }, solid: true },
};
export const MAX_PIECES = 2000; // on one farm

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
export const WEAPONS = {
  wooden_sword: { reach: 1.9, knock: 7, every: 700, drops: 1 },
  mallet: { reach: 2, knock: 11, every: 1100, drops: 2 },
};
export const BOP_GRACE = 2500;
export const SAFE_CIRCLE = 3.5;
export const DROP_MS = 45_000; // a drop nobody picks up fades after this

// Finds rare enough that the whole lobby hears when one turns up
export const RARE = {
  golden_seeds: 'Golden seeds',
  key: 'An old key',
};

// Roll a spot's loot: [item, count]. rand: () => [0, 1)
export function rollLoot(kind, rand = Math.random) {
  const { loot } = SPOT_KINDS[kind];
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
