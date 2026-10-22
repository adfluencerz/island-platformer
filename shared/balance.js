// ---------- Balancing ----------
// Every number that decides how the game plays out, in one place: how long
// things take to grow back, what things cost, what they give and what they
// sell for. Change a number here and both the page and the server go by it
// (this file is plain JS, so it runs in both).
//
// Times are real seconds unless they say game hours (a game day lasts
// DAY_LENGTH_SECONDS, so a game hour is DAY_LENGTH_SECONDS / 24 seconds).
// [min, max] means a roll somewhere between the two, each time.
//
// What uses each part: the item catalog (src/items.js), the world and its
// lobbies (shared/level.js, shared/room.js), the workbench (src/workbench.js),
// the animals (src/animals.js), the farm's finds (src/finds.js), fishing
// (shared/fishing.js) and a new farmer's backpack (src/main.js).

// ---------- Time ----------
export const DAY_LENGTH_SECONDS = 1440; // a whole game day, in real seconds
export const SOIL_BARE_HOURS = [1.5, 2.5]; // game hours until tilled soil left empty goes back to grass

// The relics, one on each style of sky isle (shared/skyisles.js): rare finds,
// sold, or put on show on the farm (each is its own decoration: BUILD_COSTS)
const RELICS = ['cloud_feather', 'brass_cog', 'sky_crystal', 'jade_blossom', 'glowing_spore', 'sea_glass_lens', 'fallen_star', 'royal_honeycomb', 'golden_apple',
  'snow_globe', 'jade_teacup', 'silver_bell', 'ancient_acorn', 'desert_rose', 'moon_pearl', 'pocket_watch', 'golden_horseshoe', 'crystal_ball'];

// ---------- Money ----------
// The merchant at the farm stall: `price` is what they ask for one (no price:
// they don't sell it), `sell` what they pay for one (no sell: they won't buy it).
export const SHOP = {
  // seeds
  turnip_seeds: { price: 20, sell: 10 },
  carrot_seeds: { price: 35, sell: 17 },
  flax_seeds: { price: 45, sell: 22 },
  sunflower_seeds: { price: 60, sell: 30 },
  golden_seeds: { sell: 100 },
  // crops
  turnip: { sell: 35 },
  carrot: { sell: 60 },
  flax: { sell: 80 },
  sunflower: { sell: 45 }, // (the crop and the lobby's wild sunflower are one item)
  golden_turnip: { sell: 150 },
  // gathered in lobbies
  berries: { sell: 15 },
  mushroom: { sell: 25 },
  heather: { sell: 30 },
  cattail: { sell: 35 },
  bluebell: { sell: 40 },
  pumpkin: { sell: 50 },
  fern: { sell: 40 },
  seashell: { sell: 40 },
  gem: { sell: 200 },
  ...Object.fromEntries(RELICS.map((relic) => [relic, { sell: 400 }])), // (the sky isles' relics)
  wood: { sell: 6 },
  stone: { sell: 4 },
  // animals, and what they give
  hen: { price: 150, sell: 20 },
  cow: { price: 500, sell: 100},
  sheep: { price: 350, sell: 70 },
  egg: { sell: 25 },
  milk: { sell: 60 },
  wool: { sell: 120 },
  // fished up (see Fishing)
  sardine: { sell: 18 },
  mackerel: { sell: 30 },
  sea_bass: { sell: 55 },
  pufferfish: { sell: 130 },
  moonfish: { sell: 160 },
  seaweed: { sell: 8 },
  minnow: { sell: 15 },
  perch: { sell: 28 },
  sunfish: { sell: 50 },
  catfish: { sell: 65 },
  koi: { sell: 150 },
  trout: { sell: 40 },
  salmon: { sell: 70 },
  rainbow_trout: { sell: 110 },
  glowfish: { sell: 220 },
  golden_carp: { sell: 450 },
  old_boot: { sell: 2 },
};
export const COIN_VALUE = 10; // gold for picking up one coin

// What a new farmer starts with in the backpack: [item, count]
export const STARTER_KIT = [['hoe', 1], ['axe', 1], ['pickaxe', 1], ['turnip_seeds', 10], ['flax_seeds', 5], ['stone', 200], ['wood', 500]];

// ---------- Crops ----------
// Seconds from planting to ripe (real seconds: a farm left alone grows on too)
export const CROP_GROW_TIME = { turnip: 100, carrot: 150, flax: 175, sunflower: 225, golden_turnip: 300 };

// ---------- Animals ----------
// `regrow`: game hours until a cow or sheep has more to give ('morning': the
// next morning). A hen lays one egg a day, at some hour in LAY_HOURS, and
// stops while EGGS_PER_HEN of hers lie about uncollected.
export const ANIMALS = {
  cow: { product: 'milk', regrow: 'morning' },
  sheep: { product: 'wool', regrow: 48 },
};
export const LAY_HOURS = [8, 16];
export const EGGS_PER_HEN = 3;

// ---------- Trees and rocks ----------
// `hits`: swings to fell one or break one up (STURDY_HITS with a sturdy tool).
// `regrow`: seconds until it is back (somewhere else; see shared/level.js).
// `wood`: logs from a tree of size 1 (bigger trees give more). `stone`: from
// a rock of size `per` (a fist-sized one; the big boulders give the most).
export const TREE_BALANCE = { hits: 4, regrow: [600, 600], wood: [2, 4] };
export const ROCK_BALANCE = { hits: 3, regrow: [900, 900], stone: [1, 2], per: 0.4 };
export const STURDY_HITS = { sturdy_axe: 3, sturdy_pickaxe: 2 };

// ---------- Giant trees and rocks ----------
// Each game morning a lobby or farm without a giant tree may get one (one
// standing tree grows huge): `chance` of it. The same, apart, for a giant
// rock. Once its giant tree is down a place never gets another (nor rocks).
// A giant takes `hits` times the swings of an ordinary one, from everyone
// together, and gives `loot` times what it would, shared by how much each
// farmer did. `treeScale`, `rockScale`: how much bigger it is drawn
// (`rockMin`: a giant rock is at least this big, even a pebble's). The health
// bar over it shows `barSeconds` after the last swing.
export const GIANT = { chance: 0.05, hits: 35, loot: 50, treeScale: 2.5, rockScale: 2.5, rockMin: 1.6, barSeconds: 4 };

// ---------- Lobby spots ----------
// What a lobby's resource spots turn up. `regrow`: seconds until an emptied
// spot has something again. `loot`: [item, weight, min, max]: each time it
// regrows one is picked (the higher the weight, the likelier) with min..max of it.
export const LOBBY_SPOTS = {
  bush: { regrow: [35, 50], loot: [['berries', 1, 2, 3]] },
  mushroom: { regrow: [25, 40], loot: [['mushroom', 0.95, 1, 2], ['golden_seeds', 0.05, 1, 1]] },
  heather: { regrow: [30, 45], loot: [['heather', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 2 islands)
  cattail: { regrow: [30, 45], loot: [['cattail', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 4)
  bluebell: { regrow: [30, 45], loot: [['bluebell', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 5)
  sunflower: { regrow: [30, 45], loot: [['sunflower', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 6)
  pumpkin: { regrow: [30, 45], loot: [['pumpkin', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 7)
  fern: { regrow: [30, 45], loot: [['fern', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 8)
  seashell: { regrow: [30, 45], loot: [['seashell', 0.93, 1, 3], ['golden_seeds', 0.07, 1, 1]] }, // (generation 9)
  meadow: {
    regrow: [30, 50],
    loot: [['coin', 0.72, 1, 1], ['turnip_seeds', 0.22, 2, 4], ['flax_seeds', 0.18, 1, 2], ['golden_seeds', 0.04, 1, 1], ['key', 0.04, 1, 1]],
  },
  // up on the sky isles (generation 10): finds lying about, and on the steps up
  sky: {
    regrow: [40, 60],
    loot: [['coin', 0.5, 2, 4], ['gem', 0.22, 1, 1], ['sunflower_seeds', 0.12, 2, 3], ['carrot_seeds', 0.1, 2, 4], ['golden_seeds', 0.05, 1, 1], ['key', 0.1, 1, 1]],
  },
  // (the relic and the chests up there: what is on them is rolled their own way, SKY_CHESTS)
  relic: { regrow: [0, 0], loot: [] },
  sky_chest: { regrow: [0, 0], loot: [] },
  sky_vault: { regrow: [0, 0], loot: [] },
  ledge: {
    regrow: [40, 60],
    loot: [['gem', 0.45, 1, 1], ['carrot_seeds', 0.25, 2, 4], ['sunflower_seeds', 0.2, 1, 3], ['flax_seeds', 0.18, 1, 2], ['golden_seeds', 0.06, 1, 1], ['key', 0.08, 1, 1]],
  },
};

// ---------- Sky isles (generation 10) ----------
// Landmasses floating over a lobby's island, each up its own stair of floating
// steps (shared/skyisles.js). `count`: how many an island has. `radius`, `top`:
// how wide each is and how high up. `firstStep`: how high the lowest step is;
// `rise`: about how much higher each next one is (a jump reaches ~1.8);
// `stepSize`: how wide a step is. `finds`: sky spots lying about on each.
export const SKY_ISLES = { count: [1, 3], radius: [5, 7.5], top: [9, 15], firstStep: [0.9, 1.2], rise: 1.15, stepSize: [1.6, 2], finds: [2, 3] };
// The chests up there: a sky_chest whoever gets to first opens, and a locked
// sky_vault an old key opens (the key is used up). `rolls`: how many things
// are in one, each from `loot` ([item, weight, min, max], as for the spots;
// the same thing twice is one stack).
export const SKY_CHESTS = {
  sky_chest: { rolls: [3, 5], loot: [['coin', 0.45, 2, 5], ['gem', 0.15, 1, 1], ['carrot_seeds', 0.12, 2, 4], ['sunflower_seeds', 0.12, 2, 3], ['flax_seeds', 0.1, 2, 3], ['golden_seeds', 0.04, 1, 1], ['key', 0.06, 1, 1]] },
  sky_vault: { rolls: [4, 6], loot: [['coin', 0.35, 4, 8], ['gem', 0.3, 1, 2], ['golden_seeds', 0.15, 1, 2], ['sunflower_seeds', 0.1, 3, 5], ['carrot_seeds', 0.1, 3, 5]] },
};

// ---------- Finds on the farm ----------
// Now and then something turns up on your own farm while you play it alone.
export const FARM_FINDS = {
  every: 60, // seconds of play between rolls
  chance: 0.15, // that a roll turns something up
  two: 0.3, // that it is two finds, not one
  most: 2, // on the farm at once
  loot: [ // [item, weight, min, max], as for lobby spots
    ['coin', 0.5, 1, 2],
    ['turnip_seeds', 0.16, 2, 3],
    ['carrot_seeds', 0.12, 1, 3],
    ['flax_seeds', 0.1, 1, 2],
    ['sunflower_seeds', 0.07, 1, 2],
    ['gem', 0.04, 1, 1],
    ['golden_seeds', 0.01, 1, 1],
  ],
};

// ---------- Building ----------
// What each piece costs to build (it all goes back when it is taken down).
// The flower planter costs the one made at the workbench (see RECIPES).
export const BUILD_COSTS = {
  wood_fence: { wood: 2 },
  stone_wall: { stone: 3 },
  wood_path: { wood: 1 },
  stone_path: { stone: 1 },
  wood_gate: { wood: 3 },
  wood_crate: { wood: 3 },
  stone_step: { stone: 2 },
  stone_block: { stone: 3 },
  wood_step: { wood: 2 },
  log_pile: { wood: 4 },
  wood_scaffold: { wood: 5 },
  tall_stone_block: { stone: 5 },
  stone_pillar: { stone: 8 },
  low_stone_wall: { stone: 2 },
  wood_palisade: { wood: 4 },
  wood_barrel: { wood: 4 },
  straw_step: { flax: 2 },
  straw_bale: { flax: 3 },
  straw_stack: { flax: 6 },
  log_tower: { wood: 8 },
  stone_arch: { stone: 5 },
  cobble_path: { stone: 2 },
  rail_fence: { wood: 3 },
  wood_arbor: { wood: 5 },
  gravel_path: { stone: 1 },
  mossy_stone_block: { stone: 4 },
  stone_well: { stone: 6, wood: 3 },
  box_hedge: { wood: 1, flax: 2 },
  stepping_stones: { stone: 1 },
  tree_stump: { wood: 2 },
  crate_stack: { wood: 6 },
  stone_lantern: { stone: 5 },
  scarecrow: { wood: 3, flax: 2 },
  picket_fence: { wood: 3 },
  grain_sacks: { flax: 4 },
  hay_cart: { wood: 6, flax: 3 },
  beehive: { wood: 2, flax: 3 },
  birdbath: { stone: 3 },
  signpost: { wood: 2 },
  wattle_fence: { wood: 3 },
  water_trough: { wood: 4 },
  stone_bench: { stone: 4 },
  sundial: { stone: 4 },
  wheelbarrow: { wood: 3, stone: 1 },
  barrel_stack: { wood: 8 },
  torch: { wood: 1, flax: 1 },
  log_fence: { wood: 3 },
  mailbox: { wood: 2 },
  birdhouse: { wood: 2 },
  flagpole: { wood: 3, flax: 2 },
  stone_cairn: { stone: 3 },
  clothesline: { wood: 2, flax: 2 },
  workbench: { wood: 10, stone: 5 },
  farm_chest: { wood: 8, stone: 2 },
  house: { wood: 500, stone: 200 },
  lamp_post: { wood: 3, stone: 2 },
  ...Object.fromEntries(RELICS.map((relic) => [relic, { [relic]: 1 }])), // (a relic on its pedestal: the relic itself)
  garden_bench: { wood: 6 },
  planter: { planter: 1 },
  pond: { stone: 30 },
};

// ---------- The workbench ----------
// What can be made, in the order it is listed. `needs`: items used up (a
// tool among them is swapped for the one made, in its slot).
export const RECIPES = [
  { makes: 'planter', needs: { stone: 4, wood: 1 } },
  { makes: 'sturdy_axe', needs: { axe: 1, wood: 12, stone: 8 } },
  { makes: 'sturdy_pickaxe', needs: { pickaxe: 1, wood: 8, stone: 12 } },
  { makes: 'wide_hoe', needs: { hoe: 1, wood: 10, stone: 10 } },
  { makes: 'wooden_sword', needs: { wood: 8 } },
  { makes: 'mallet', needs: { wood: 4, stone: 6 } },
  { makes: 'fishing_rod', needs: { wood: 5, flax: 2 } },
  { makes: 'sturdy_rod', needs: { fishing_rod: 1, wood: 15, stone: 10, flax: 4 } },
  { makes: 'golden_rod', needs: { sturdy_rod: 1, gem: 2, wood: 20 } },
];

// Made at the workbench once, built straight from wood and stone now: what
// one is worth, for a backpack or a chest that still has some
export const UNMADE = { lamp_post: { wood: 3, stone: 2 }, garden_bench: { wood: 6 } };

// items ({ item: count }), with any of those turned back into what they cost
export function unmake(items) {
  const out = {};
  for (const [item, n] of Object.entries(items ?? {})) {
    for (const [what, k] of Object.entries(UNMADE[item] ?? { [item]: 1 })) out[what] = (out[what] ?? 0) + k * n;
  }
  return out;
}

// ---------- Bopping (lobbies) ----------
// With one in hand, E bops the farmer in front within `reach`: knocked back
// (at `knock`), they drop up to `drops` of something gathered this visit.
// `every`: ms between swings that count.
export const WEAPONS = {
  wooden_sword: { reach: 1.9, knock: 7, every: 700, drops: 1 },
  mallet: { reach: 2, knock: 11, every: 1100, drops: 2 },
};
export const BOP_GRACE = 2500; // ms a farmer who was just bopped can't be again
export const SAFE_CIRCLE = 3.5; // nobody bops or is bopped this close to where farmers arrive
export const DROP_MS = 45_000; // a drop nobody picks up fades after this (ms)

// ---------- Fishing ----------
// With a rod in hand, E facing water casts; a while later the bobber dips,
// and E again in time lands what bit (in a lobby the server rolls it). `bite`:
// seconds [min, max] from the cast till something bites, with each rod.
// `luck`: how much likelier a rarer catch is with it (for each step of rarity,
// times this). The rods are made at the workbench, each from the one before.
export const RODS = {
  fishing_rod: { bite: [6, 13], luck: 1 },
  sturdy_rod: { bite: [4, 9], luck: 1.5 },
  golden_rod: { bite: [2.5, 6], luck: 2 },
};
// ms to press E once the bobber dips, by how rare what bit is (0 common .. 3 the rarest)
export const BITE_WINDOW = [1300, 1000, 750, 550];
export const CAST_EVERY = 1200; // ms: the fewest between two casts
// What bites where: the sea round your farm, a pond built on it, and any
// water in a lobby (its sea and its pond: rarer things). Each [item, weight,
// rarity, { rod, hours, count }]: `rod` the least rod it bites for (1: a
// sturdy one, 2: golden), `hours` [from, to] of game time it bites in (past
// midnight if from > to), `count` [min, max] of it (else one). 'chest': a
// little chest of loot (FISHED_CHEST); wood is driftwood.
export const FISHING = {
  sea: [
    ['sardine', 30, 0], ['mackerel', 22, 0], ['sea_bass', 12, 1],
    ['pufferfish', 4, 2, { rod: 1 }], ['moonfish', 5, 2, { hours: [20, 5] }],
    ['seaweed', 6, 0], ['old_boot', 5, 0], ['wood', 4, 0, { count: [2, 4] }],
    ['key', 0.8, 2], ['chest', 1.5, 2],
  ],
  pond: [
    ['minnow', 30, 0], ['perch', 22, 0], ['sunfish', 10, 1, { hours: [9, 17] }],
    ['catfish', 10, 1, { hours: [18, 6] }], ['koi', 4, 2, { rod: 1 }],
    ['old_boot', 4, 0], ['key', 0.6, 2], ['chest', 1, 2],
  ],
  lobby: [
    ['trout', 26, 0], ['salmon', 18, 1], ['rainbow_trout', 9, 1],
    ['glowfish', 4, 2, { hours: [21, 4] }], ['golden_carp', 1.2, 3, { rod: 1 }],
    ['old_boot', 4, 0], ['key', 1.5, 2], ['chest', 3, 2],
  ],
};
// What is in a little chest fished up: `rolls` things, each from `loot`
// ([item, weight, min, max], as for the sky isle chests)
export const FISHED_CHEST = { rolls: [2, 3], loot: [['coin', 0.5, 2, 5], ['gem', 0.15, 1, 1], ['carrot_seeds', 0.12, 2, 4], ['sunflower_seeds', 0.1, 1, 3], ['golden_seeds', 0.05, 1, 1], ['key', 0.03, 1, 1]] };

// ---------- Room to keep things ----------
export const CHEST = { stack: 999, kinds: 64 }; // the most of one item in a farm chest, and of different items
